/**
 * EXR listings scraper — ported from the Leasing-OS scraper, targeting
 * https://www.exrplatform.com/listings/rentals
 *
 * Strategy (in priority order):
 *  1. Extract embedded __NEXT_DATA__ JSON (works when the site is Next.js SSR)
 *  2. Extract JSON-LD structured data (schema.org RealEstateListing)
 *  3. Regex-based HTML card parsing (fallback — the path that actually works
 *     for EXR's Phoenix LiveView markup)
 *
 * Changes from the Leasing-OS original, for What's the Rent:
 *  - Collects the FULL /ads_images/ gallery per listing (`photos: string[]`)
 *    instead of a single hero photo, so the game can reveal multiple photos.
 *  - `scrapeAllExrListings` also returns `seenUrls` (every listing URL seen
 *    on the site this run) so off-market detection downstream can be
 *    conservative — a listing is only treated as leased once it's fully
 *    absent from the site.
 *  - Optional `maxEnrich` caps how many new listings get their detail page
 *    fetched per run, so the job fits inside serverless time limits and
 *    backfills incrementally across runs.
 */

const BASE_URL = 'https://www.exrplatform.com'
const LISTINGS_PATH = '/listings/rentals'
const PAGE_DELAY_MS = 1000 // 1 s between pages — 500 ms was triggering silent rate-limit breaks

export interface ExrListingRaw {
  address: string
  unit: string | null
  neighborhood: string | null
  borough: string | null
  beds: number | null
  baths: number | null
  rent: number | null
  photos: string[]
  concession: string | null
  exr_listing_url: string
}

export interface ScrapeResult {
  listings: ExrListingRaw[]
  /** Every listing URL seen on the site this run (before address filtering). */
  seenUrls: string[]
}

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function parseRent(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return Math.round(raw)
  const cleaned = String(raw).replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}

function parseBedsBaths(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return raw
  const s = String(raw).toLowerCase().trim()
  if (s === 'studio' || s === '0') return 0
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function normalizeConcession(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  if (lower === 'op' || lower === 'owner pays' || lower === 'owner pay') return 'No Fee'
  if (lower === 'no fee' || lower === 'no_fee') return 'No Fee'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function toAbsoluteUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

async function fetchPage(url: string): Promise<string> {
  const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    next: { revalidate: 0 },
  }
  const res = await fetch(url, fetchOptions as RequestInit)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  }
  return res.text()
}

// ─── extraction strategies ───────────────────────────────────────────────────

function extractFromNextData(html: string): ExrListingRaw[] {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  )
  if (!match) return []

  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return []
  }

  const candidates = [
    getPath(data, ['props', 'pageProps', 'listings']),
    getPath(data, ['props', 'pageProps', 'rentals']),
    getPath(data, ['props', 'pageProps', 'results']),
    getPath(data, ['props', 'pageProps', 'data', 'listings']),
    getPath(data, ['props', 'pageProps', 'data', 'results']),
    getPath(data, ['props', 'pageProps', 'properties']),
    getPath(data, ['props', 'pageProps', 'data', 'properties']),
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const mapped = candidate.map(mapNextDataListing).filter(Boolean) as ExrListingRaw[]
      if (mapped.length > 0) return mapped
    }
  }
  return []
}

function getPath(obj: unknown, path: string[]): unknown {
  let current = obj
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function photosFromField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(p =>
        typeof p === 'string'
          ? toAbsoluteUrl(p)
          : typeof p === 'object' && p !== null
            ? toAbsoluteUrl(
                String(
                  (p as Record<string, unknown>)['url'] ??
                  (p as Record<string, unknown>)['src'] ??
                  (p as Record<string, unknown>)['href'] ??
                  ''
                )
              )
            : ''
      )
      .filter(Boolean)
  }
  if (typeof value === 'string' && value) return [toAbsoluteUrl(value)]
  return []
}

function mapNextDataListing(raw: unknown): ExrListingRaw | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const address =
    (r['address'] ?? r['streetAddress'] ?? r['street_address'] ?? r['Address']) as string | undefined
  const slug = (r['slug'] ?? r['url'] ?? r['link'] ?? r['href'] ?? r['permalink']) as string | undefined
  const listingId = (r['id'] ?? r['listingId'] ?? r['listing_id'] ?? r['mlsId']) as string | number | undefined

  let exr_listing_url = ''
  if (typeof slug === 'string' && slug.startsWith('http')) {
    exr_listing_url = slug
  } else if (typeof slug === 'string') {
    exr_listing_url = toAbsoluteUrl(slug.startsWith('/') ? slug : `/listings/${slug}`)
  } else if (listingId) {
    exr_listing_url = `${BASE_URL}/listings/${listingId}`
  }

  if (!address || !exr_listing_url) return null

  const neighborhood =
    (r['neighborhood'] ?? r['area'] ?? r['zone'] ?? r['submarket']) as string | null | undefined
  const borough =
    (r['borough'] ?? r['city'] ?? r['region'] ?? r['county']) as string | null | undefined
  const unit =
    (r['unit'] ?? r['unitNumber'] ?? r['unit_number'] ?? r['aptNumber']) as string | null | undefined

  const beds = parseBedsBaths(
    (r['bedrooms'] ?? r['beds'] ?? r['bedroom_count'] ?? r['numBedrooms']) as string | number | undefined
  )
  const baths = parseBedsBaths(
    (r['bathrooms'] ?? r['baths'] ?? r['bathroom_count'] ?? r['numBathrooms']) as string | number | undefined
  )
  const rent = parseRent(
    (r['price'] ?? r['rent'] ?? r['listPrice'] ?? r['list_price'] ?? r['monthlyRent']) as string | number | undefined
  )

  let photos = photosFromField(r['photos'] ?? r['images'] ?? r['media'])
  if (photos.length === 0) {
    const single = r['photoUrl'] ?? r['photo'] ?? r['image']
    if (typeof single === 'string') photos = [toAbsoluteUrl(single)]
  }

  const concession =
    (r['concession'] ?? r['incentive'] ?? r['offer'] ?? r['specialOffer'] ?? r['promotion']) as string | null | undefined

  return {
    address: String(address).trim(),
    unit: unit ? String(unit).trim() : null,
    neighborhood: neighborhood ? String(neighborhood).trim() : null,
    borough: borough ? String(borough).trim() : null,
    beds,
    baths,
    rent,
    photos,
    concession: concession ? String(concession).trim() : null,
    exr_listing_url,
  }
}

function extractFromJsonLd(html: string): ExrListingRaw[] {
  const results: ExrListingRaw[] = []
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    let data: unknown
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }

    const items: unknown[] = []
    if (Array.isArray(data)) {
      items.push(...data)
    } else if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>
      if (d['@graph'] && Array.isArray(d['@graph'])) {
        items.push(...(d['@graph'] as unknown[]))
      } else {
        items.push(data)
      }
    }

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue
      const d = item as Record<string, unknown>
      const type = d['@type']
      if (
        type !== 'Apartment' &&
        type !== 'RealEstateListing' &&
        type !== 'Product' &&
        type !== 'Place'
      )
        continue

      const address =
        typeof d['address'] === 'string'
          ? d['address']
          : (d['address'] as Record<string, unknown> | null | undefined)?.['streetAddress'] as string | undefined

      const url = d['url'] as string | undefined
      if (!address || !url) continue

      results.push({
        address: String(address).trim(),
        unit: null,
        neighborhood:
          typeof d['address'] === 'object' && d['address'] !== null
            ? ((d['address'] as Record<string, unknown>)['addressLocality'] as string | null) ?? null
            : null,
        borough:
          typeof d['address'] === 'object' && d['address'] !== null
            ? ((d['address'] as Record<string, unknown>)['addressRegion'] as string | null) ?? null
            : null,
        beds: parseBedsBaths((d['numberOfRooms'] ?? d['numberOfBedrooms']) as string | number | undefined),
        baths: null,
        rent: parseRent((d['price'] ?? (d['offers'] as Record<string, unknown> | undefined)?.['price']) as string | number | undefined),
        photos: photosFromField(d['image']),
        concession: null,
        exr_listing_url: toAbsoluteUrl(url),
      })
    }
  }

  return results
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NYC_BOROUGHS = ['Brooklyn', 'Queens', 'Manhattan', 'Bronx', 'Staten Island']

const NYC_NEIGHBORHOODS = [
  // Brooklyn
  'Williamsburg', 'Bushwick', 'Greenpoint', 'Ridgewood', 'Bed-Stuy',
  'Bedford-Stuyvesant', 'Crown Heights', 'Park Slope', 'Flatbush',
  'East New York', 'Fort Greene', 'Clinton Hill', 'Prospect Heights',
  'Carroll Gardens', 'Cobble Hill', 'Red Hook', 'Gowanus', 'Sunset Park',
  'Bay Ridge', 'Bensonhurst', 'Borough Park', 'Flatlands', 'Canarsie',
  'East Flatbush', 'Prospect Lefferts Gardens', 'Brownsville', 'Kensington',
  'Windsor Terrace', 'Dyker Heights', 'Marine Park', 'Sheepshead Bay',
  'Little Haiti',
  // Queens
  'Astoria', 'Long Island City', 'Flushing', 'Jackson Heights', 'Forest Hills',
  'Jamaica', 'Bayside', 'Sunnyside', 'Woodside', 'Corona', 'Elmhurst',
  'Rego Park', 'Maspeth', 'Glendale', 'Middle Village',
  'Ozone Park', 'Richmond Hill', 'South Ozone Park', 'Springfield Gardens',
  // Manhattan
  'Upper East Side', 'Upper West Side', 'Midtown', "Hell's Kitchen",
  'Lower East Side', 'East Village', 'West Village', 'Chelsea', 'Harlem',
  'Washington Heights', 'Inwood', 'Murray Hill', 'Financial District',
  'Tribeca', 'SoHo', 'NoHo', 'Nolita', 'Gramercy', 'Kips Bay',
  'Turtle Bay', 'Lenox Hill', 'Carnegie Hill', 'Morningside Heights',
  // Bronx
  'South Bronx', 'Fordham', 'Riverdale', 'Pelham', 'Mott Haven',
  'Concourse', 'Tremont', 'Belmont', 'Norwood', 'Port Morris',
]

function extractFromHtml(html: string, pageUrl: string): ExrListingRaw[] {
  const results: ExrListingRaw[] = []

  const urlRegexUuid    = /href=["'](\/listings\/[^"'#?\/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/gi
  const urlRegexNumeric = /href=["'](\/listings\/(\d+)\/[a-z0-9][a-z0-9-]{3,})["']/gi

  const seen = new Set<string>()
  const allMatches: Array<{ relUrl: string; matchIndex: number }> = []

  let urlMatch: RegExpExecArray | null
  while ((urlMatch = urlRegexUuid.exec(html)) !== null) {
    if (!seen.has(urlMatch[1])) {
      seen.add(urlMatch[1])
      allMatches.push({ relUrl: urlMatch[1], matchIndex: urlMatch.index })
    }
  }
  while ((urlMatch = urlRegexNumeric.exec(html)) !== null) {
    if (!seen.has(urlMatch[1])) {
      seen.add(urlMatch[1])
      allMatches.push({ relUrl: urlMatch[1], matchIndex: urlMatch.index })
    }
  }

  for (const { relUrl, matchIndex } of allMatches) {
    const exr_listing_url = toAbsoluteUrl(relUrl)

    const windowStart = Math.max(0, matchIndex - 100)
    const windowEnd   = Math.min(html.length, matchIndex + 2000)
    const rawWindow   = html.slice(windowStart, windowEnd)
    const cleanText   = stripHtml(rawWindow)

    const rentMatch = cleanText.match(/\$\s*([\d,]+)\s*(?:\/\s*mo(?:nth)?)?/i)
    const rent = rentMatch ? parseRent(rentMatch[1]) : null

    const ST = 'Street|Avenue|Boulevard|Road|Drive|Lane|Place|Court|Way|Terrace|Parkway|Highway|St\\.?|Ave\\.?|Blvd\\.?|Rd\\.?|Dr\\.?|Ln\\.?|Pl\\.?|Ct\\.?|Ter\\.?|Pkwy\\.?|Hwy\\.?'
    const DIR = '(?:North|South|East|West|[NSEW])\\.?\\s+'
    const addrRegex = new RegExp(
      `\\b(\\d{1,5}\\s+(?:${DIR})?(?:\\d+(?:st|nd|rd|th)\\s+(?:${ST})|[A-Z][a-zA-Z]+(?:\\s+[A-Za-z]+){0,4}\\s+(?:${ST})))\\b`
    )
    const addrMatch = cleanText.match(addrRegex)
    const address = addrMatch ? addrMatch[1].trim() : ''

    const unitMatch = cleanText.match(/(?:Unit|Apt|Suite|#)\s*([A-Za-z0-9-]+)/i)
    const unit = unitMatch ? unitMatch[1] : null

    const bedsMatch   = cleanText.match(/(\d+)\s*(?:bed(?:room)?s?|BR|bd)\b/i)
    const studioMatch = cleanText.match(/\bstudio\b/i)
    const bathsMatch  = cleanText.match(/(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|BA|ba)\b/i)
    const beds  = bedsMatch ? parseInt(bedsMatch[1]) : studioMatch ? 0 : null
    const baths = bathsMatch ? parseFloat(bathsMatch[1]) : null

    let borough: string | null = null
    let neighborhood: string | null = null
    for (const b of NYC_BOROUGHS) {
      if (cleanText.includes(b)) { borough = b; break }
    }
    for (const n of NYC_NEIGHBORHOODS) {
      if (cleanText.includes(n)) { neighborhood = n; break }
    }

    const concessionMatch = cleanText.match(
      /(\d+\s+(?:month|mo)s?\s+free|no\s+fee|owner\s+pays|\bop\b|free\s+month)/i
    )
    const concession = normalizeConcession(concessionMatch ? concessionMatch[1].trim() : null)

    // Photos are extracted per-listing during enrichment, not from the
    // index window (adjacent cards bleed into the window).
    results.push({
      address,
      unit,
      neighborhood,
      borough,
      beds,
      baths,
      rent,
      photos: [],
      concession,
      exr_listing_url,
    })
  }

  if (results.length > 0) {
    console.log(
      `[EXR scraper] HTML fallback for ${pageUrl}: ${results.length} listings. ` +
      'If addresses look wrong, the site structure may have changed.'
    )
  }

  return results
}

function extractBuildingUrls(html: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  const regex = /href=["'](\/buildings\/[^"'#?\s]+)["']/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      results.push(m[1])
    }
  }
  return results
}

// ─── photo extraction (full gallery) ─────────────────────────────────────────

/**
 * Extract every genuine per-unit photo from a listing page.
 *
 * EXR serves images via imgix with URL-encoded inner paths. A page also
 * embeds building-marketing shots (/advertisements/) and agent headshots
 * (/agents/) that are reused across unrelated listings; only /ads_images/
 * URLs are the unit's own photography. We collect all image candidates,
 * keep just the /ads_images/ ones, and dedupe (multiple imgix renditions of
 * the same source collapse to one).
 */
function extractPhotos(html: string): string[] {
  const candidates: string[] = []

  for (const m of html.matchAll(
    /https:\/\/[^"'\s]*\.imgix\.net\/(https?%3A%2F%2F[^?"'\s&]+(?:\.jpg|\.jpeg|\.png|\.webp|\.avif)[^"'\s]*)/gi
  )) {
    try { candidates.push(decodeURIComponent(m[1]).replace(/&amp;/g, '&')) } catch { /* ignore */ }
  }
  for (const m of html.matchAll(/(https:\/\/[^"'\s]*\.imgix\.net\/[^"'\s]+)/gi)) {
    candidates.push(m[1].replace(/&amp;/g, '&'))
  }
  for (const m of html.matchAll(/srcset=["'](https?:\/\/[^"'\s,]+)/g)) {
    candidates.push(m[1].replace(/&amp;/g, '&'))
  }
  for (const m of html.matchAll(/\/_next\/image\?url=([^&"'\s]+)/g)) {
    try {
      const decoded = decodeURIComponent(m[1])
      candidates.push(decoded.startsWith('http') ? decoded : toAbsoluteUrl(decoded))
    } catch { /* ignore */ }
  }
  for (const m of html.matchAll(
    /src=["'](https?:\/\/[^"'\s]{20,}\.(?:jpg|jpeg|png|webp|avif)[^"'\s]*)["']/gi
  )) {
    candidates.push(m[1].replace(/&amp;/g, '&'))
  }

  const seen = new Set<string>()
  const photos: string[] = []
  for (const url of candidates) {
    if (!/\/ads_images\//i.test(url)) continue
    const key = url.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)
    photos.push(key)
  }
  return photos
}

// ─── listing enrichment ──────────────────────────────────────────────────────

interface ListingDetails {
  address: string | null
  photos: string[]
  rent: number | null
  beds: number | null
  baths: number | null
  neighborhood: string | null
  borough: string | null
}

async function fetchListingDetails(listingUrl: string): Promise<ListingDetails> {
  const empty: ListingDetails = { address: null, photos: [], rent: null, beds: null, baths: null, neighborhood: null, borough: null }
  let html: string
  try {
    html = await fetchPage(listingUrl)
  } catch {
    return empty
  }

  const photos = extractPhotos(html)
  const text = stripHtml(html)

  let beds: number | null = null
  if (/\/studio[-/]/i.test(listingUrl)) {
    beds = 0
  } else {
    const slugBeds = listingUrl.match(/\/(\d+)-beds?[-/]/i)
    beds = slugBeds ? parseInt(slugBeds[1]) : null
  }
  if (beds === null) {
    const textBeds = text.match(/\b(\d)\s*(?:bed(?:room)?s?|BR|BD)\b/i)
    const textStudio = /\bstudio\b/i.test(text)
    beds = textBeds ? parseInt(textBeds[1]) : textStudio ? 0 : null
  }

  let rentMatch = text.match(/\$\s*([\d,]+)\s*(?:\/\s*mo(?:nth)?)?/i)
  if (!rentMatch) {
    const m = text.match(/\b([\d,]{4,6})\s*(?:\/\s*mo(?:nth)?|per\s+month)\b/i)
    if (m) rentMatch = m
  }
  const rent = rentMatch ? parseRent(rentMatch[1]) : null

  const bathsMatch =
    text.match(/\b(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)\b/i) ??
    text.match(/\/\s*(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)\b/i)
  const baths = bathsMatch ? parseFloat(bathsMatch[1]) : null

  let neighborhood: string | null = null
  let borough: string | null = null

  const slugMatchUuid    = listingUrl.match(/\/listings\/([^/]+)\/[0-9a-f-]{36}/i)
  const slugMatchNumeric = listingUrl.match(/\/listings\/\d+\/([^/?#]+)/i)
  const slugWords        = (slugMatchUuid?.[1] ?? slugMatchNumeric?.[1] ?? '').replace(/-/g, ' ').toLowerCase()

  if (slugWords) {
    for (const b of [...NYC_BOROUGHS].sort((a, b) => b.length - a.length)) {
      if (slugWords.includes(b.toLowerCase())) { borough = b; break }
    }
    for (const n of [...NYC_NEIGHBORHOODS].sort((a, b) => b.length - a.length)) {
      if (slugWords.includes(n.toLowerCase())) { neighborhood = n; break }
    }
  }

  if (!neighborhood || !borough) {
    const locationMatch = text.match(
      /for\s+rent\s+in\s+([\w][^,\n]+?),\s*(Brooklyn|Queens|Manhattan|(?:The\s+)?Bronx|Staten Island)\b/i
    )
    if (locationMatch) {
      if (!neighborhood) neighborhood = locationMatch[1].trim()
      if (!borough)      borough      = locationMatch[2].replace(/^The\s+/i, '').trim()
    }
  }

  const addrMatch = text.match(
    /\b(\d{1,5}\s+(?:(?:North|South|East|West|[NSEW])\.?\s+)?(?:\d+(?:st|nd|rd|th)\s+(?:Street|Avenue|Boulevard|Road|Drive|Lane|Place|Court|Way|Terrace|Parkway|Highway|St|Ave|Blvd|Rd|Dr|Ln|Pl|Ct|Ter|Pkwy|Hwy)\.?|[A-Za-z][a-zA-Z]+(?:\s+[A-Za-z]+){0,4}\s+(?:Street|Avenue|Boulevard|Road|Drive|Lane|Place|Court|Way|Terrace|Parkway|Highway|St|Ave|Blvd|Rd|Dr|Ln|Pl|Ct|Ter|Pkwy|Hwy)\.?))\b/i
  )
  const address = addrMatch ? addrMatch[1].trim() : null

  return { address, photos, rent, beds, baths, neighborhood, borough }
}

async function enrichListings(
  listings: ExrListingRaw[],
  alreadyEnriched: Set<string>,
  maxEnrich: number,
): Promise<ExrListingRaw[]> {
  const BATCH_SIZE = 5
  const byUrl = new Map(listings.map(l => [l.exr_listing_url, l]))

  const toFetch = listings
    .filter(l => !alreadyEnriched.has(l.exr_listing_url))
    .slice(0, maxEnrich)
  console.log(
    `[EXR scraper] Enriching ${toFetch.length} listings ` +
    `(${listings.length - toFetch.length} skipped — already enriched or over per-run cap)`
  )

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async l => ({
        url: l.exr_listing_url,
        details: await fetchListingDetails(l.exr_listing_url),
      }))
    )
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const listing = byUrl.get(r.value.url)
      if (!listing) continue
      const { address, photos, rent, beds, baths, neighborhood, borough } = r.value.details
      if (address) listing.address = address
      if (photos.length > 0) listing.photos = photos
      if (rent !== null)  listing.rent         = rent
      if (beds !== null)  listing.beds         = beds
      if (baths !== null) listing.baths        = baths
      if (neighborhood)   listing.neighborhood = neighborhood
      if (borough)        listing.borough      = borough
    }
  }

  const withPhoto = listings.filter(l => (byUrl.get(l.exr_listing_url)?.photos.length ?? 0) > 0).length
  const withRent  = listings.filter(l => byUrl.get(l.exr_listing_url)?.rent !== null).length
  console.log(`[EXR scraper] Enriched: ${withPhoto} with photos, ${withRent} with rent, of ${listings.length}`)

  return [...byUrl.values()]
}

/**
 * Fetch just the photos for a set of listing detail pages — no index scrape.
 * Used to backfill photos for listings already in the DB, fast.
 */
export async function scrapeListingPhotos(
  urls: string[]
): Promise<{ url: string; photos: string[] }[]> {
  const BATCH_SIZE = 5;
  const out: { url: string; photos: string[] }[] = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const html = await fetchPage(url);
          return { url, photos: extractPhotos(html) };
        } catch {
          return { url, photos: [] };
        }
      })
    );
    for (const r of results) if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

// ─── page scraper ────────────────────────────────────────────────────────────

async function scrapePage(pageNum: number): Promise<{ listings: ExrListingRaw[], buildingUrls: string[] }> {
  const url =
    pageNum === 1
      ? `${BASE_URL}${LISTINGS_PATH}`
      : `${BASE_URL}${LISTINGS_PATH}?page=${pageNum}`

  console.log(`[EXR scraper] Fetching page ${pageNum}: ${url}`)
  const html = await fetchPage(url)
  const buildingUrls = extractBuildingUrls(html)

  let listings = extractFromNextData(html)
  if (listings.length > 0) {
    console.log(`[EXR scraper] Page ${pageNum}: ${listings.length} listings from __NEXT_DATA__`)
    return { listings, buildingUrls }
  }

  listings = extractFromJsonLd(html)
  if (listings.length > 0) {
    console.log(`[EXR scraper] Page ${pageNum}: ${listings.length} listings from JSON-LD`)
    return { listings, buildingUrls }
  }

  listings = extractFromHtml(html, url)
  console.log(
    listings.length > 0
      ? `[EXR scraper] Page ${pageNum}: ${listings.length} listings from HTML regex`
      : `[EXR scraper] Page ${pageNum}: 0 listings — site may require JS rendering`
  )
  return { listings, buildingUrls }
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Scrape all rental listings from EXR.
 *
 * @param alreadyEnriched exr_listing_urls whose detail pages should NOT be
 *   re-fetched (already have full data in the DB) — keeps runs fast.
 * @param maxEnrich cap on how many new listings get their detail page fetched
 *   this run, so the job fits inside serverless time limits. Remaining new
 *   listings are picked up on subsequent runs.
 */
export async function scrapeAllExrListings(
  alreadyEnriched: Set<string> = new Set(),
  maxEnrich = 40,
): Promise<ScrapeResult> {
  const MAX_PAGES = 10
  const all: ExrListingRaw[] = []
  const seenUrls = new Set<string>()
  const allBuildingPaths = new Set<string>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(PAGE_DELAY_MS)

    let pageResult: { listings: ExrListingRaw[], buildingUrls: string[] }
    try {
      pageResult = await scrapePage(page)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[EXR scraper] Error fetching page ${page}: ${msg}`)
      if (page === 1) throw err
      break
    }

    if (pageResult.listings.length === 0) break

    for (const l of pageResult.listings) {
      if (!seenUrls.has(l.exr_listing_url)) {
        seenUrls.add(l.exr_listing_url)
        all.push(l)
      }
    }
    for (const u of pageResult.buildingUrls) allBuildingPaths.add(u)
  }

  console.log(`[EXR scraper] Index pages: ${all.length} listings, ${allBuildingPaths.size} building pages to check`)

  if (allBuildingPaths.size > 0) {
    for (const buildingPath of allBuildingPaths) {
      await sleep(PAGE_DELAY_MS)
      const buildingUrl = toAbsoluteUrl(buildingPath)
      try {
        const html = await fetchPage(buildingUrl)
        const extra = extractFromHtml(html, buildingUrl)
        for (const l of extra) {
          if (!seenUrls.has(l.exr_listing_url)) {
            seenUrls.add(l.exr_listing_url)
            all.push(l)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[EXR scraper] Error fetching building page ${buildingPath}: ${msg}`)
      }
    }
  }

  console.log(`[EXR scraper] Total listings seen: ${all.length}`)

  const enriched = await enrichListings(all, alreadyEnriched, maxEnrich)
  const withAddress = enriched.filter(l => !!l.address)

  return { listings: withAddress, seenUrls: [...seenUrls] }
}
