/**
 * Pure/testable core — no "server-only" guard here so this file can be
 * imported directly from node:test (that package throws unconditionally
 * outside a bundler's "react-server" condition, plain Node included). The
 * guarded, real import surface is lib/pluto.ts, which just re-exports this.
 *

 * NYC PLUTO (Primary Land Use Tax Lot Output, NYC Dept. of City Planning)
 * — dataset 64uk-42ks on NYC Open Data, queried via the Socrata Open Data
 * API (SODA, plain REST/JSON). Independent of listing source: PLUTO covers
 * every tax lot in the city keyed by address/BBL, so it enriches
 * EXR-sourced and manually-entered listings the same as StreetEasy ones —
 * unlike scraping StreetEasy's building page, which only covers StreetEasy.
 *
 * VERIFICATION NOTE: this sandbox's network egress proxy blocks
 * data.cityofnewyork.us (and dev.socrata.com), so the live schema could
 * not be queried while writing this — confirmed via direct curl and
 * WebFetch, both rejected at the proxy before reaching the host. The field
 * names below follow PLUTO's well-established Socrata convention (source
 * column names lowercased with no separator: YearBuilt -> yearbuilt,
 * BldgArea -> bldgarea, ZipCode -> zipcode, Address -> address, Latitude ->
 * latitude), but `YEAR_BUILT_KEYS` checks a couple of plausible casings
 * defensively rather than trusting a single hardcoded key, and every
 * lookup fails closed (null) rather than throwing on an unexpected shape.
 * Verify against a live response before relying on this in production:
 *   curl "https://data.cityofnewyork.us/resource/64uk-42ks.json?\$limit=1"
 * and adjust the keys/query fields below if the live schema differs.
 */

const SODA_BASE = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const YEAR_BUILT_KEYS = ["yearbuilt", "year_built", "yearBuilt"];
const ADDRESS_KEYS = ["address"];
const LAT_KEYS = ["latitude"];
const LNG_KEYS = ["longitude"];

const CURRENT_YEAR = new Date().getFullYear();
const REQUEST_TIMEOUT_MS = 8000;

type SodaRow = Record<string, unknown>;

function firstDefined(row: SodaRow, keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/**
 * PLUTO uses 0 for "year unknown" — not a real year — and occasionally
 * carries data-entry typos (implausibly old or future values). Treat
 * anything outside a sane building-age window as no data rather than
 * surfacing garbage.
 */
function parseYear(value: unknown): number | null {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 1700 || n > CURRENT_YEAR + 1) return null;
  return n;
}

/**
 * Normalize an address for matching against PLUTO's format: upper-cased,
 * punctuation stripped, ordinal suffixes dropped ("21st" -> "21") since
 * PLUTO's own address field doesn't consistently carry them either.
 */
function normalizeAddress(address: string): { houseNumber: string; full: string } {
  const cleaned = address
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const houseNumber = cleaned.match(/^(\d+)\s+/)?.[1] ?? "";
  return { houseNumber, full: cleaned };
}

async function sodaQuery(params: URLSearchParams): Promise<SodaRow[] | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.NYC_OPEN_DATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.NYC_OPEN_DATA_APP_TOKEN;
    }
    const res = await fetch(`${SODA_BASE}?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as SodaRow[]) : null;
  } catch {
    return null;
  }
}

/**
 * $q is Socrata's fuzzy full-text search — far more forgiving than an exact
 * $where match against PLUTO's own address formatting quirks. Re-rank the
 * top few hits locally by house-number match, since $q can return
 * neighboring addresses too.
 */
async function lookupByAddress(address: string): Promise<SodaRow | null> {
  const { houseNumber, full } = normalizeAddress(address);
  if (!full) return null;
  const rows = await sodaQuery(new URLSearchParams({ $q: full, $limit: "5" }));
  if (!rows || rows.length === 0) return null;

  for (const row of rows) {
    const rowAddress = firstDefined(row, ADDRESS_KEYS);
    if (typeof rowAddress !== "string") continue;
    if (houseNumber && normalizeAddress(rowAddress).houseNumber === houseNumber) return row;
  }
  return rows[0];
}

/** Small bounding box around the point; nearest centroid by simple distance wins. */
async function lookupByLatLng(lat: number, lng: number): Promise<SodaRow | null> {
  const delta = 0.0015; // ~150-165m at NYC's latitude
  const rows = await sodaQuery(
    new URLSearchParams({
      $where: `latitude between ${lat - delta} and ${lat + delta} and longitude between ${lng - delta} and ${lng + delta}`,
      $limit: "20",
    })
  );
  if (!rows || rows.length === 0) return null;

  let best: SodaRow | null = null;
  let bestDist = Infinity;
  for (const row of rows) {
    const rLat = Number(firstDefined(row, LAT_KEYS));
    const rLng = Number(firstDefined(row, LNG_KEYS));
    if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
    const dist = (rLat - lat) ** 2 + (rLng - lng) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = row;
    }
  }
  return best;
}

export interface PlutoLookupInput {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Enrich a listing with PLUTO's year-built figure. Address is preferred;
 * lat/lng is the fallback when there's no address or the address didn't
 * match anything. Never throws — any failure (no match, network error,
 * unexpected shape) resolves to null, since this is a nice-to-have
 * enrichment, not a required field.
 */
export async function lookupYearBuilt(input: PlutoLookupInput): Promise<number | null> {
  try {
    let row: SodaRow | null = null;
    if (input.address?.trim()) {
      row = await lookupByAddress(input.address);
    }
    if (!row && typeof input.lat === "number" && typeof input.lng === "number") {
      row = await lookupByLatLng(input.lat, input.lng);
    }
    if (!row) return null;
    return parseYear(firstDefined(row, YEAR_BUILT_KEYS));
  } catch {
    return null;
  }
}
