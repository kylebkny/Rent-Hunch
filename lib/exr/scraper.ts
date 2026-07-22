// EXR listings scraper.
//
// ⚠️ PORTED FROM DESCRIPTION, NOT VERIFIED. This is reconstructed from the
// investigation report of the Leasing-OS `lib/exr/scraper.ts`, not the real
// file, and it has NOT been run against the live site (the build sandbox
// can't reach exrplatform.com). The fetch/pagination/rate-limiting/photo
// scaffolding is sound, but the field-parsing regexes below are best-effort
// and should be replaced with the proven ones from the original scraper.
// The parsing seams (`extractListingUrls`, `parseListingDetail`,
// `extractPhotos`) are isolated so that swap is a drop-in.

const BASE_URL = "https://www.exrplatform.com";
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 1000;
const BATCH_SIZE = 5;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const BOROUGHS = ["Brooklyn", "Queens", "Manhattan", "Bronx", "Staten Island"];

export interface ExrListingRaw {
  address: string;
  unit: string | null;
  neighborhood: string | null;
  borough: string | null;
  beds: number | null;
  baths: number | null;
  rent: number | null;
  photos: string[];
  concession: string | null;
  exr_listing_url: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Find listing detail-page URLs on an index/rentals page. */
export function extractListingUrls(html: string): string[] {
  // Detail pages look like /listings/{slug}/{uuid} or /listings/{id}/{slug}.
  const re = /\/listings\/[a-z0-9-]+\/[a-z0-9-]+/gi;
  const found = new Set<string>();
  for (const m of html.matchAll(re)) {
    // Skip the index route itself.
    if (m[0].startsWith("/listings/rentals")) continue;
    found.add(BASE_URL + m[0]);
  }
  return [...found];
}

/** Pull every listing gallery photo (EXR serves them under /ads_images/). */
export function extractPhotos(html: string): string[] {
  const found = new Set<string>();
  // Match src/href/background URLs pointing at the ads_images path, incl.
  // imgix-proxied variants; strip query strings for stable dedupe.
  const re = /https?:\/\/[^"'\s)]*\/ads_images\/[^"'\s)]+/gi;
  for (const m of html.matchAll(re)) {
    found.add(m[0].split("?")[0]);
  }
  return [...found];
}

function parseInt0(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse a single listing detail page into the raw shape. */
export function parseListingDetail(html: string, url: string): ExrListingRaw | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const rentMatch = text.match(/\$\s?([0-9][0-9,]{2,})(?:\s?\/\s?mo)?/i);
  const rent = rentMatch ? parseInt0(rentMatch[1]) : null;

  const bedMatch = text.match(/(\d+)\s*(?:bed|bd|br)\b/i);
  const beds = /studio/i.test(text) && !bedMatch ? 0 : bedMatch ? parseInt0(bedMatch[1]) : null;

  const bathMatch = text.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)\b/i);
  const baths = bathMatch ? Number(bathMatch[1]) : null;

  const borough = BOROUGHS.find((b) => new RegExp(`\\b${b}\\b`, "i").test(text)) ?? null;

  // Neighborhood: prefer the "... for rent in {Neighborhood}, {Borough}" phrasing.
  const nhoodMatch = text.match(/for rent in ([A-Z][A-Za-z\s-]+?),\s*(?:Brooklyn|Queens|Manhattan|Bronx|Staten Island)/);
  const neighborhood = nhoodMatch ? nhoodMatch[1].trim() : null;

  const addrMatch = text.match(/(\d{1,4}\s+[A-Z][A-Za-z0-9.\s]+?(?:Street|St|Avenue|Ave|Place|Pl|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Terrace|Ter))/);
  const address = addrMatch ? addrMatch[1].trim() : neighborhood ?? "Brooklyn rental";

  const unitMatch = text.match(/(?:unit|apt|#)\s*([0-9]{1,3}[A-Za-z]?)/i);
  const unit = unitMatch ? unitMatch[1] : null;

  const concession = /no fee/i.test(text)
    ? "No Fee"
    : (text.match(/(\d+\s*months?\s*free)/i)?.[1] ?? null);

  const photos = extractPhotos(html);

  if (rent === null && beds === null) return null; // couldn't parse — skip

  return { address, unit, neighborhood, borough, beds, baths, rent, photos, concession, exr_listing_url: url };
}

/**
 * Scrape all current EXR rental listings. Returns the raw listings found on
 * this run — these are ACTIVE (on-market) listings; off-market inference
 * happens downstream in the ingest step by absence across runs.
 */
export async function scrapeExrRentals(): Promise<ExrListingRaw[]> {
  const detailUrls = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchHtml(`${BASE_URL}/listings/rentals?page=${page}`);
    if (!html) break;
    const urls = extractListingUrls(html);
    if (urls.length === 0) break;
    urls.forEach((u) => detailUrls.add(u));
    await sleep(PAGE_DELAY_MS);
  }

  const results: ExrListingRaw[] = [];
  const urls = [...detailUrls];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const parsed = await Promise.all(
      batch.map(async (url) => {
        const html = await fetchHtml(url);
        return html ? parseListingDetail(html, url) : null;
      })
    );
    for (const p of parsed) if (p) results.push(p);
  }

  return results;
}
