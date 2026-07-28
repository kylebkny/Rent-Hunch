/**
 * StreetEasy listing import.
 *
 * Two independent layers, because StreetEasy sits behind bot protection and a
 * server-side fetch is often blocked:
 *
 *   1. `parseStreetEasyUrl` — reads the address/unit/borough straight out of
 *      the URL slug. No network, so it always works. Combined with Google
 *      geocoding in the admin this alone fills address, neighborhood, borough,
 *      nearest train and lat/lng.
 *   2. `parseListingHtml` — pulls rent/beds/baths/photos out of the page HTML.
 *      Fed either by our own best-effort fetch or by HTML the admin pasted
 *      from their own browser when the fetch is blocked.
 */

import { AMENITY_OPTIONS, NYC_NEIGHBORHOODS } from "@/lib/listing-options";

export interface StreetEasyUrlParts {
  /** Street address recovered from the slug, e.g. "119 North 11 Street". */
  address: string | null;
  /** Apartment line, e.g. "3C". */
  unit: string | null;
  borough: string | null;
  /** Canonical URL with tracking params stripped. */
  canonicalUrl: string;
}

export interface StreetEasyListingFields {
  rent: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  amenities: string[];
  photos: string[];
}

const BOROUGH_SLUGS: Record<string, string> = {
  brooklyn: "Brooklyn",
  manhattan: "Manhattan",
  queens: "Queens",
  bronx: "Bronx",
  "staten-island": "Staten Island",
  "new-york": "Manhattan",
  nyc: "Manhattan",
};

/** Slug tokens that are ordinals/directions we want cased normally. */
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (/^\d+[a-z]{0,2}$/i.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Accept what people actually paste: with or without a scheme, with or
 * without `www.`, and with trailing whitespace from a copy. Returns null if
 * it isn't a StreetEasy link at all.
 */
export function normalizeStreetEasyUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!/^(www\.)?streeteasy\.com$/i.test(url.hostname)) return null;
  return url.toString();
}

export function isStreetEasyUrl(value: string): boolean {
  return normalizeStreetEasyUrl(value) !== null;
}

/**
 * StreetEasy URLs come in a few shapes:
 *   /building/119-north-11-street-brooklyn/3c   ← address + unit in the slug
 *   /building/the-nathaniel/12b                 ← named building, no address
 *   /rental/1234567                             ← opaque id, nothing to read
 */
export function parseStreetEasyUrl(rawUrl: string): StreetEasyUrlParts | null {
  const normalized = normalizeStreetEasyUrl(rawUrl);
  if (!normalized) return null;
  const url = new URL(normalized);

  const canonicalUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  const empty: StreetEasyUrlParts = { address: null, unit: null, borough: null, canonicalUrl };
  if (segments[0] !== "building") return empty;

  const buildingSlug = segments[1] ?? "";
  const unitSlug = segments[2] ?? "";

  // Trailing borough token, when present, is not part of the street address.
  let borough: string | null = null;
  let addressSlug = buildingSlug;
  for (const [slug, name] of Object.entries(BOROUGH_SLUGS)) {
    if (addressSlug.endsWith(`-${slug}`)) {
      borough = name;
      addressSlug = addressSlug.slice(0, -(slug.length + 1));
      break;
    }
  }

  // Only treat the slug as an address if it starts with a house number —
  // otherwise it's a building name ("the-nathaniel") and geocoding it as an
  // address would be wrong.
  const address = /^\d/.test(addressSlug) ? titleCaseSlug(addressSlug) : null;
  const unit = unitSlug ? unitSlug.toUpperCase() : null;

  return { address, unit, borough, canonicalUrl };
}

// ─── HTML parsing ─────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const m = html.match(re) ?? html.match(alt);
  return m ? decodeEntities(m[1]) : null;
}

/** Every JSON-LD blob on the page, parsed and flattened. */
function jsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const push = (node: unknown) => {
        if (node && typeof node === "object") out.push(node as Record<string, unknown>);
      };
      if (Array.isArray(parsed)) parsed.forEach(push);
      else {
        push(parsed);
        const graph = (parsed as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) graph.forEach(push);
      }
    } catch {
      // Malformed blob — skip it, the text fallbacks still apply.
    }
  }
  return out;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Pull the listing facts out of a StreetEasy page. Everything is best-effort:
 * each field falls back from structured data → meta tags → visible text, and
 * anything that can't be found stays null for the admin to fill in.
 */
export function parseListingHtml(html: string): StreetEasyListingFields {
  const fields: StreetEasyListingFields = {
    rent: null,
    beds: null,
    baths: null,
    sqft: null,
    address: null,
    neighborhood: null,
    borough: null,
    amenities: [],
    photos: [],
  };

  // 1. Structured data.
  for (const node of jsonLdNodes(html)) {
    const addr = node.address as Record<string, unknown> | undefined;
    if (addr && typeof addr === "object") {
      const street = addr.streetAddress;
      if (!fields.address && typeof street === "string") fields.address = street.trim();
      const locality = addr.addressLocality;
      if (!fields.borough && typeof locality === "string") fields.borough = locality.trim();
    }
    const offers = node.offers as Record<string, unknown> | undefined;
    if (offers && typeof offers === "object" && fields.rent === null) {
      fields.rent = num(offers.price);
    }
    if (fields.rent === null) fields.rent = num(node.price);
    if (fields.beds === null) fields.beds = num(node.numberOfBedrooms ?? node.numberOfRooms);
    if (fields.baths === null) {
      fields.baths = num(node.numberOfBathroomsTotal ?? node.numberOfBathrooms);
    }
    const size = node.floorSize as Record<string, unknown> | undefined;
    if (fields.sqft === null && size && typeof size === "object") fields.sqft = num(size.value);
  }

  const text = stripTags(html);
  const title = metaContent(html, "og:title") ?? "";
  const description = metaContent(html, "og:description") ?? "";
  const haystack = `${title} ${description} ${text}`;

  // 2. Rent — "$4,500" near a /mo marker, else the first plausible price.
  if (fields.rent === null) {
    const m =
      haystack.match(/\$\s?([\d,]{3,9})\s*(?:\/\s*(?:mo|month)|per\s+month)/i) ??
      haystack.match(/\$\s?([\d,]{4,9})/);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 300 && n <= 200_000) fields.rent = n;
    }
  }

  // 3. Beds / baths.
  if (fields.beds === null) {
    // An explicit bed count wins; "studio" is only consulted when there isn't
    // one, so a "studio-style kitchen" in a 2-bed's description can't win.
    const m = haystack.match(/(\d+)\s*(?:bed(?:room)?s?\b|bd\b|BR\b)/i);
    if (m) fields.beds = parseInt(m[1], 10);
    else if (/\bstudio\b/i.test(haystack)) fields.beds = 0;
  }
  if (fields.baths === null) {
    const m = haystack.match(/(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?\b|ba\b)/i);
    if (m) fields.baths = parseFloat(m[1]);
  }
  if (fields.sqft === null) {
    const m = haystack.match(/([\d,]{3,6})\s*(?:ft²|sq\.?\s*ft|square\s+feet)/i);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n > 100 && n < 20_000) fields.sqft = n;
    }
  }

  // 4. Neighborhood. Matching our own list first is far more reliable than a
  // shape-based regex, and it keeps the value consistent with the typeahead.
  // Longest match wins so "East Williamsburg" beats "Williamsburg".
  const lowerHay = haystack.toLowerCase();
  for (const candidate of NYC_NEIGHBORHOODS) {
    const c = candidate.toLowerCase();
    if (!new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lowerHay)) continue;
    if (!fields.neighborhood || candidate.length > fields.neighborhood.length) {
      fields.neighborhood = candidate;
    }
  }
  // Fall back to the shape StreetEasy copy uses: "… in Williamsburg, Brooklyn"
  // or a bare "Williamsburg, Brooklyn" line.
  const hood =
    haystack.match(
      /\bin\s+([A-Z][A-Za-z'’.\- ]{2,30}?),\s*(Brooklyn|Manhattan|Queens|Bronx|Staten Island|New York)\b/
    ) ??
    haystack.match(
      /\b([A-Z][A-Za-z'’.\- ]{2,30}?),\s*(Brooklyn|Manhattan|Queens|Bronx|Staten Island|New York)\b/
    );
  if (hood) {
    fields.neighborhood = fields.neighborhood ?? hood[1].trim();
    fields.borough = fields.borough ?? (hood[2] === "New York" ? "Manhattan" : hood[2]);
  }
  if (!fields.borough) {
    const b = haystack.match(/\b(Brooklyn|Manhattan|Queens|Bronx|Staten Island)\b/);
    if (b) fields.borough = b[1];
  }
  if (fields.borough === "New York") fields.borough = "Manhattan";

  // 5. Amenities — match our controlled vocabulary against the page text.
  const lowerText = haystack.toLowerCase();
  const synonyms: Record<string, string[]> = {
    "In-unit Laundry": ["washer/dryer in unit", "in-unit laundry", "washer / dryer"],
    "Laundry in Building": ["laundry in building", "laundry room"],
    "Fitness Center": ["gym", "fitness"],
    "Private Outdoor Space": ["private outdoor", "terrace", "patio"],
    "Stainless Appliances": ["stainless"],
    "Central AC": ["central air", "central a/c", "central ac"],
    "Pets Allowed": ["pets allowed", "pet friendly", "dogs allowed", "cats allowed"],
    "Recently Renovated": ["renovated", "gut renovated"],
    "No Fee": ["no fee"],
    "Live-in Super": ["live-in super", "live in super"],
  };
  for (const amenity of AMENITY_OPTIONS) {
    const needles = synonyms[amenity] ?? [amenity.toLowerCase()];
    if (needles.some((n) => lowerText.includes(n))) fields.amenities.push(amenity);
  }

  // 6. Photos — StreetEasy serves listing images off Zillow's CDN.
  const photoRe = /https:\/\/photos\.zillowstatic\.com\/[^\s"'\\<>]+?\.(?:jpg|jpeg|png|webp)/gi;
  const seen = new Set<string>();
  for (const url of html.match(photoRe) ?? []) {
    const clean = decodeEntities(url);
    if (!seen.has(clean)) {
      seen.add(clean);
      fields.photos.push(clean);
    }
  }
  const ogImage = metaContent(html, "og:image");
  if (ogImage && !seen.has(ogImage)) fields.photos.unshift(ogImage);
  fields.photos = fields.photos.slice(0, 12);

  if (fields.baths !== null) fields.baths = Math.round(fields.baths * 2) / 2;
  if (fields.beds !== null) fields.beds = Math.round(fields.beds);

  return fields;
}
