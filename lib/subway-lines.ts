/**
 * Station → subway lines lookup.
 *
 * Google Places gives us the nearest `subway_station` by name ("Bedford Av")
 * but not which trains stop there, so the train clue was showing a station
 * with no lines. This maps the station back to its lines.
 *
 * The source of truth below is keyed by ROUTE (line → its stations), because
 * that's how the system is actually laid out and it's far easier to keep
 * correct; the station → lines index is derived from it, so a transfer
 * station automatically accumulates every line that lists it.
 *
 * Coverage is Manhattan + Brooklyn (the boroughs the game uses). A station we
 * don't know simply returns [] and the caller falls back to the
 * neighborhood-level lines from `deriveTransit`.
 */

const ROUTES: Record<string, string[]> = {
  "1": [
    "215 St", "207 St", "Dyckman St", "191 St", "181 St", "168 St", "157 St",
    "145 St", "137 St-City College", "125 St", "116 St-Columbia University",
    "Cathedral Pkwy-110 St", "103 St", "96 St", "86 St", "79 St", "72 St",
    "66 St-Lincoln Center", "59 St-Columbus Circle", "50 St", "Times Sq-42 St",
    "34 St-Penn Station", "28 St", "23 St", "18 St", "14 St",
    "Christopher St-Sheridan Sq", "Houston St", "Canal St", "Franklin St",
    "Chambers St", "WTC Cortlandt", "Rector St", "South Ferry",
  ],
  "2": [
    "135 St", "125 St", "116 St", "Central Park North-110 St", "96 St", "72 St",
    "Times Sq-42 St", "34 St-Penn Station", "14 St", "Chambers St", "Park Place",
    "Fulton St", "Wall St", "Clark St", "Borough Hall", "Hoyt St", "Nevins St",
    "Atlantic Av-Barclays Ctr", "Bergen St", "Grand Army Plaza",
    "Eastern Pkwy-Brooklyn Museum", "Franklin Av", "President St", "Sterling St",
    "Winthrop St", "Church Av", "Beverly Rd", "Newkirk Av",
    "Flatbush Av-Brooklyn College",
  ],
  "3": [
    "Harlem-148 St", "145 St", "135 St", "125 St", "116 St",
    "Central Park North-110 St", "96 St", "72 St", "Times Sq-42 St",
    "34 St-Penn Station", "14 St", "Chambers St", "Park Place", "Fulton St",
    "Wall St", "Clark St", "Borough Hall", "Hoyt St", "Nevins St",
    "Atlantic Av-Barclays Ctr", "Bergen St", "Grand Army Plaza",
    "Eastern Pkwy-Brooklyn Museum", "Franklin Av", "Nostrand Av", "Kingston Av",
    "Crown Heights-Utica Av", "Sutter Av-Rutland Rd", "Saratoga Av",
    "Rockaway Av", "Junius St", "Pennsylvania Av", "Van Siclen Av", "New Lots Av",
  ],
  "4": [
    "125 St", "86 St", "59 St", "Grand Central-42 St", "14 St-Union Sq",
    "Brooklyn Bridge-City Hall", "Fulton St", "Wall St", "Bowling Green",
    "Borough Hall", "Nevins St", "Atlantic Av-Barclays Ctr", "Franklin Av",
    "Crown Heights-Utica Av",
  ],
  "5": [
    "125 St", "86 St", "59 St", "Grand Central-42 St", "14 St-Union Sq",
    "Brooklyn Bridge-City Hall", "Fulton St", "Wall St", "Bowling Green",
    "Borough Hall", "Nevins St", "Atlantic Av-Barclays Ctr", "Franklin Av",
    "President St", "Sterling St", "Winthrop St", "Church Av", "Beverly Rd",
    "Newkirk Av", "Flatbush Av-Brooklyn College",
  ],
  "6": [
    "125 St", "116 St", "110 St", "103 St", "96 St", "86 St", "77 St",
    "68 St-Hunter College", "59 St", "51 St", "Grand Central-42 St", "33 St",
    "28 St", "23 St", "14 St-Union Sq", "Astor Pl", "Bleecker St", "Spring St",
    "Canal St", "Brooklyn Bridge-City Hall",
  ],
  "7": [
    "34 St-Hudson Yards", "Times Sq-42 St", "5 Av", "Grand Central-42 St",
    "Vernon Blvd-Jackson Av", "Hunters Point Av", "Court Sq", "Queensboro Plaza",
  ],
  A: [
    "Inwood-207 St", "190 St", "181 St", "175 St", "168 St", "145 St", "125 St",
    "59 St-Columbus Circle", "42 St-Port Authority Bus Terminal",
    "34 St-Penn Station", "14 St", "W 4 St-Washington Sq", "Canal St",
    "Chambers St", "Fulton St", "High St", "Jay St-MetroTech",
    "Hoyt-Schermerhorn Sts", "Nostrand Av", "Utica Av", "Broadway Junction",
    "Euclid Av", "Grant Av",
  ],
  C: [
    "168 St", "163 St-Amsterdam Av", "155 St", "145 St", "135 St", "125 St",
    "116 St", "Cathedral Pkwy-110 St", "103 St", "96 St",
    "86 St", "81 St-Museum of Natural History", "72 St", "59 St-Columbus Circle",
    "50 St", "42 St-Port Authority Bus Terminal", "34 St-Penn Station", "23 St",
    "14 St", "W 4 St-Washington Sq", "Spring St", "Canal St", "Chambers St",
    "Fulton St", "High St", "Jay St-MetroTech", "Hoyt-Schermerhorn Sts",
    "Lafayette Av", "Clinton-Washington Avs", "Franklin Av", "Nostrand Av",
    "Kingston-Throop Avs", "Utica Av", "Ralph Av", "Rockaway Av",
    "Broadway Junction", "Liberty Av", "Van Siclen Av", "Shepherd Av",
    "Euclid Av",
  ],
  E: [
    "Court Sq", "Queens Plaza", "Lexington Av-53 St", "5 Av-53 St", "7 Av",
    "50 St", "42 St-Port Authority Bus Terminal", "34 St-Penn Station", "23 St",
    "14 St", "W 4 St-Washington Sq", "Spring St", "Canal St",
    "World Trade Center",
  ],
  B: [
    "145 St", "135 St", "125 St", "116 St", "Cathedral Pkwy-110 St", "103 St",
    "96 St", "86 St", "81 St-Museum of Natural History", "72 St",
    "59 St-Columbus Circle", "7 Av", "47-50 Sts-Rockefeller Ctr",
    "42 St-Bryant Pk", "34 St-Herald Sq", "W 4 St-Washington Sq",
    "Broadway-Lafayette St", "Grand St", "DeKalb Av", "Atlantic Av-Barclays Ctr",
    "7 Av", "Prospect Park", "Church Av", "Newkirk Plaza", "Kings Highway",
    "Sheepshead Bay", "Brighton Beach",
  ],
  D: [
    "145 St", "125 St", "59 St-Columbus Circle", "7 Av",
    "47-50 Sts-Rockefeller Ctr", "42 St-Bryant Pk", "34 St-Herald Sq",
    "W 4 St-Washington Sq", "Broadway-Lafayette St", "Grand St", "DeKalb Av",
    "Atlantic Av-Barclays Ctr", "36 St", "9 Av", "Fort Hamilton Pkwy", "50 St",
    "55 St", "62 St", "71 St", "79 St", "18 Av", "20 Av", "Bay Pkwy", "25 Av",
    "Bay 50 St", "Coney Island-Stillwell Av",
  ],
  F: [
    "Roosevelt Island", "Lexington Av-63 St", "57 St",
    "47-50 Sts-Rockefeller Ctr", "42 St-Bryant Pk", "34 St-Herald Sq", "23 St",
    "14 St", "W 4 St-Washington Sq", "Broadway-Lafayette St", "2 Av",
    "Delancey St-Essex St", "East Broadway", "York St", "Jay St-MetroTech",
    "Bergen St", "Carroll St", "Smith-9 Sts", "4 Av-9 St", "7 Av",
    "15 St-Prospect Park", "Fort Hamilton Pkwy", "Church Av", "Ditmas Av",
    "18 Av", "Avenue I", "Bay Pkwy", "Avenue N", "Avenue P", "Kings Highway",
    "Avenue U", "Avenue X", "Neptune Av", "W 8 St-NY Aquarium",
    "Coney Island-Stillwell Av",
  ],
  M: [
    "Lexington Av-53 St", "5 Av-53 St", "47-50 Sts-Rockefeller Ctr",
    "42 St-Bryant Pk", "34 St-Herald Sq", "23 St", "14 St",
    "W 4 St-Washington Sq", "Broadway-Lafayette St", "2 Av",
    "Delancey St-Essex St", "Marcy Av", "Hewes St", "Lorimer St", "Flushing Av",
    "Myrtle Av", "Central Av", "Knickerbocker Av", "Myrtle-Wyckoff Avs",
    "Seneca Av", "Forest Av", "Fresh Pond Rd", "Court Sq", "Queens Plaza",
  ],
  G: [
    "Court Sq", "21 St", "Greenpoint Av", "Nassau Av", "Metropolitan Av",
    "Broadway", "Flushing Av", "Myrtle-Willoughby Avs", "Bedford-Nostrand Avs",
    "Classon Av", "Clinton-Washington Avs", "Fulton St", "Hoyt-Schermerhorn Sts",
    "Bergen St", "Carroll St", "Smith-9 Sts", "4 Av-9 St", "7 Av",
    "15 St-Prospect Park", "Fort Hamilton Pkwy", "Church Av",
  ],
  J: [
    "Broad St", "Fulton St", "Chambers St", "Canal St", "Bowery",
    "Delancey St-Essex St", "Marcy Av", "Hewes St", "Lorimer St", "Flushing Av",
    "Myrtle Av", "Kosciuszko St", "Gates Av", "Halsey St", "Chauncey St",
    "Broadway Junction", "Alabama Av", "Van Siclen Av", "Cleveland St",
    "Norwood Av", "Crescent St", "Cypress Hills",
  ],
  Z: [
    "Broad St", "Fulton St", "Chambers St", "Canal St",
    "Delancey St-Essex St", "Marcy Av", "Myrtle Av", "Gates Av", "Halsey St",
    "Broadway Junction", "Van Siclen Av", "Crescent St",
  ],
  L: [
    "8 Av", "6 Av", "14 St-Union Sq", "3 Av", "1 Av", "Bedford Av", "Lorimer St",
    "Graham Av", "Grand St", "Montrose Av", "Morgan Av", "Jefferson St",
    "DeKalb Av", "Myrtle-Wyckoff Avs", "Halsey St", "Wilson Av",
    "Bushwick Av-Aberdeen St", "Broadway Junction", "Atlantic Av", "Sutter Av",
    "Livonia Av", "New Lots Av", "E 105 St", "Canarsie-Rockaway Pkwy",
  ],
  N: [
    "Lexington Av-59 St", "5 Av-59 St", "57 St-7 Av", "49 St", "Times Sq-42 St",
    "34 St-Herald Sq", "28 St", "23 St", "14 St-Union Sq", "Canal St",
    "Cortlandt St", "DeKalb Av", "Atlantic Av-Barclays Ctr", "36 St", "59 St",
    "8 Av", "Fort Hamilton Pkwy", "New Utrecht Av", "18 Av", "20 Av", "Bay Pkwy",
    "Kings Highway", "Avenue U", "86 St", "Coney Island-Stillwell Av",
  ],
  Q: [
    "96 St", "86 St", "72 St", "Lexington Av-63 St", "57 St-7 Av",
    "Times Sq-42 St", "34 St-Herald Sq", "14 St-Union Sq", "Canal St",
    "DeKalb Av", "Atlantic Av-Barclays Ctr", "7 Av", "Prospect Park",
    "Parkside Av", "Church Av", "Beverley Rd", "Cortelyou Rd", "Newkirk Plaza",
    "Avenue H", "Avenue J", "Avenue M", "Kings Highway", "Avenue U", "Neck Rd",
    "Sheepshead Bay", "Brighton Beach", "Ocean Pkwy", "W 8 St-NY Aquarium",
    "Coney Island-Stillwell Av",
  ],
  R: [
    "Lexington Av-59 St", "5 Av-59 St", "57 St-7 Av", "49 St", "Times Sq-42 St",
    "34 St-Herald Sq", "28 St", "23 St", "14 St-Union Sq", "8 St-NYU",
    "Prince St", "Canal St", "City Hall", "Cortlandt St", "Rector St",
    "Whitehall St-South Ferry", "Court St", "Jay St-MetroTech", "DeKalb Av",
    "Atlantic Av-Barclays Ctr", "Union St", "4 Av-9 St", "Prospect Av", "25 St",
    "36 St", "45 St", "53 St", "59 St", "Bay Ridge Av", "77 St", "86 St",
    "Bay Ridge-95 St",
  ],
  W: [
    "Lexington Av-59 St", "5 Av-59 St", "57 St-7 Av", "49 St", "Times Sq-42 St",
    "34 St-Herald Sq", "28 St", "23 St", "14 St-Union Sq", "8 St-NYU",
    "Prince St", "Canal St", "City Hall", "Cortlandt St", "Rector St",
    "Whitehall St-South Ferry",
  ],
  S: [
    "Times Sq-42 St", "Grand Central-42 St", "Franklin Av", "Park Place",
    "Botanic Garden", "Prospect Park",
  ],
};

/**
 * Station names vary a lot between sources ("Bedford Av", "Bedford Avenue",
 * "Bedford Avenue Station"), so both sides of the comparison get squashed to
 * a canonical form: lowercase, no punctuation, abbreviations expanded, and
 * ordinal suffixes dropped ("42nd" → "42").
 */
function normalize(name: string): string {
  let s = name.toLowerCase();
  // Drop parenthetical line lists and generic suffixes.
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\b(subway|station|stop|nyc|new york city)\b/g, " ");
  s = s.replace(/[.,'’]/g, "");
  s = s.replace(/[-–—/]/g, " ");
  // Ordinals: 42nd → 42, 1st → 1.
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  const words: Record<string, string> = {
    av: "av", ave: "av", avs: "av", avenue: "av", avenues: "av",
    st: "st", street: "st", streets: "st",
    sq: "sq", square: "sq",
    pkwy: "pkwy", parkway: "pkwy",
    blvd: "blvd", boulevard: "blvd",
    rd: "rd", road: "rd",
    ctr: "ctr", center: "ctr", centre: "ctr",
    pk: "pk", park: "park",
    ft: "fort", hts: "heights",
    e: "e", east: "e", w: "w", west: "w", n: "n", north: "n", s: "s", south: "s",
  };
  s = s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => words[w] ?? w)
    .join(" ");
  return s.trim();
}

const STATION_LINES: Map<string, string[]> = (() => {
  const index = new Map<string, Set<string>>();
  for (const [line, stations] of Object.entries(ROUTES)) {
    for (const station of stations) {
      const key = normalize(station);
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(line);
    }
  }
  // Keep a stable, readable order: numbered lines first, then lettered.
  const ordered = new Map<string, string[]>();
  for (const [key, set] of index) {
    ordered.set(
      key,
      [...set].sort((a, b) => {
        const an = /\d/.test(a), bn = /\d/.test(b);
        if (an !== bn) return an ? -1 : 1;
        return a.localeCompare(b);
      })
    );
  }
  return ordered;
})();

/** Lines serving a station, or [] when we don't recognize the name. */
export function linesForStation(stationName: string): string[] {
  if (!stationName) return [];
  const key = normalize(stationName);
  const exact = STATION_LINES.get(key);
  if (exact) return exact;

  // Google sometimes returns a shortened or lengthened variant ("Bedford Av"
  // vs "Bedford Av-N 7 St"), so fall back to a containment match on the
  // longest candidate that fits.
  let best: string[] = [];
  let bestLen = 0;
  for (const [candidate, lines] of STATION_LINES) {
    if (candidate.length <= 3) continue;
    if ((key.includes(candidate) || candidate.includes(key)) && candidate.length > bestLen) {
      best = lines;
      bestLen = candidate.length;
    }
  }
  return best;
}

// Mirrors the parser in components/TrainBullets: a group like "A/C" or "J, M",
// or a standalone letter — but never a bare digit ("3 min walk").
const LINE_RE = /(?<![A-Za-z0-9])([1-7A-Z](?:\s?[/,]\s?[1-7A-Z])+|[A-Z])(?![A-Za-z0-9])/g;
const NOT_A_LINE_AFTER = /(?:^|\s)(?:av|ave|avenue|bay|beach|pier)\s*$/i;

/** True when a clue already names at least one line (so bullets will render). */
export function hasLines(transit: string): boolean {
  for (const m of transit.matchAll(LINE_RE)) {
    if (m[1].length === 1 && NOT_A_LINE_AFTER.test(transit.slice(0, m.index))) continue;
    if (m[1].split(/[/,]/).some((t) => ROUTES[t.trim().toUpperCase()] !== undefined)) return true;
  }
  return false;
}

/**
 * Upgrade a line-less clue saved before we had the station index — e.g.
 * "Bedford Av · 4 min walk" → "L · Bedford Av · 4 min walk". Returns null when
 * the clue already names lines or the station isn't recognized, so callers can
 * skip the write.
 */
export function repairTransitClue(transit: string, neighborhoodLines = ""): string | null {
  const value = transit.trim();
  if (!value || hasLines(value)) return null;

  // "<station> · <walk time>" — anything after the first separator is detail.
  const [stationPart, ...restParts] = value.split("·");
  const station = stationPart.trim();
  const lines = linesForStation(station);
  if (lines.length === 0) return null;

  const narrowed = disambiguate(lines, neighborhoodLines);
  return [narrowed.join(", "), station, ...restParts.map((r) => r.trim())]
    .filter(Boolean)
    .join(" · ");
}

/** Pull the bare line tokens out of a string like "4/5/6, Q". */
function parseLineTokens(value: string): string[] {
  return value
    .split(/[,/\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => ROUTES[t] !== undefined);
}

/**
 * Several station names are reused across the system — there are five "86 St"
 * stations and two "DeKalb Av"s — and Google hands us only the name, so the
 * raw lookup over-reports. Narrowing by the lines the neighborhood is known
 * to have picks the right one: "86 St" in the Upper East Side resolves to
 * 4/5/6/Q, the same name in the Upper West Side to 1/B/C.
 */
function disambiguate(stationLines: string[], neighborhoodLines: string): string[] {
  const expected = new Set(parseLineTokens(neighborhoodLines));
  if (expected.size === 0) return stationLines;
  const overlap = stationLines.filter((l) => expected.has(l));
  // No overlap means the neighborhood hint is wrong or the station is just
  // outside it — trust the station over the neighborhood.
  return overlap.length > 0 ? overlap : stationLines;
}

/**
 * Build the stored transit clue: lines first (so the bullets render), then
 * the station and walk time — e.g. "L, G · Lorimer St · 4 min walk".
 * `neighborhoodLines` (from `deriveTransit`) both disambiguates repeated
 * station names and covers stations we don't recognize at all.
 */
export function formatTransitClue(
  stationName: string,
  walkMinutes: number | null,
  neighborhoodLines = ""
): string {
  const found = linesForStation(stationName);
  const lines = found.length > 0 ? disambiguate(found, neighborhoodLines) : [];
  const linePart = lines.length > 0 ? lines.join(", ") : neighborhoodLines.trim();
  const parts = [linePart, stationName, walkMinutes != null ? `${walkMinutes} min walk` : ""];
  return parts.filter(Boolean).join(" · ");
}
