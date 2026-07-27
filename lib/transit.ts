/**
 * Static Brooklyn neighborhood → nearby subway lines lookup. Used to
 * pre-fill the "nearest train" clue during listing entry so it doesn't have
 * to be typed by hand (the broker can always override). Offline and
 * deterministic — no geocoding API needed.
 */
const NEIGHBORHOOD_TRAINS: Record<string, string> = {
  williamsburg: "L, G, J/M/Z",
  greenpoint: "G",
  "bushwick": "L, J/M, M",
  "east williamsburg": "L, G",
  bedstuy: "A/C, G, J/M/Z",
  "bedford-stuyvesant": "A/C, G, J/M/Z",
  "bed-stuy": "A/C, G, J/M/Z",
  "clinton hill": "G, C",
  "fort greene": "G, C, B/Q/R, 2/3/4/5",
  "prospect heights": "2/3, B/Q, C",
  "crown heights": "3/4, A/C, S",
  "park slope": "F/G, R, 2/3, B/Q",
  gowanus: "F/G, R",
  "carroll gardens": "F/G",
  "cobble hill": "F/G",
  "boerum hill": "F/G, A/C/G, R, 2/3/4/5",
  "downtown brooklyn": "A/C/F, B/Q/R, 2/3/4/5, G",
  dumbo: "F, A/C",
  "brooklyn heights": "2/3, R, A/C, F",
  "prospect lefferts gardens": "B/Q, S, 2/5",
  flatbush: "B/Q, 2/5",
  "ditmas park": "B/Q, F",
  kensington: "F/G",
  "windsor terrace": "F/G",
  "sunset park": "D/N/R, 36 St",
  "bay ridge": "R",
  bushwick_ridgewood: "L, M",
  "prospect park": "B/Q, F/G, S",
  "red hook": "F/G (+ bus)",
  "morningside heights": "1, B/C",
  "east new york": "A/C, J/Z, L, 3",
  bushwickeast: "L, J",
  canarsie: "L",
  "brownsville": "3, L",
  "sheepshead bay": "B/Q",
  "coney island": "D/F/N/Q",
  "brighton beach": "B/Q",

  // Manhattan
  "upper east side": "4/5/6, Q",
  "upper west side": "1/2/3, B/C",
  midtown: "N/Q/R/W, B/D/F/M, 1/2/3, 7",
  "midtown east": "4/5/6, E/M, 7",
  "hell's kitchen": "A/C/E, N/Q/R/W, 1/2/3",
  chelsea: "1, C/E, F/M, A/C/E",
  "greenwich village": "A/C/E, B/D/F/M, 1",
  "west village": "1, A/C/E, L",
  "east village": "L, 6, F",
  "lower east side": "F, J/M/Z, B/D",
  soho: "6, N/R/W, C/E, B/D/F/M",
  noho: "6, B/D/F/M, N/R/W",
  nolita: "6, J/Z, B/D/F/M",
  tribeca: "1/2/3, A/C/E",
  "financial district": "2/3, 4/5, J/Z, R/W",
  "battery park city": "1, R/W, 4/5",
  gramercy: "6, L, N/Q/R/W",
  flatiron: "N/Q/R/W, F/M, 6, L",
  "union square": "4/5/6, N/Q/R/W, L",
  "murray hill": "6, 4/5, 7",
  "kips bay": "6",
  nomad: "N/Q/R/W, 6, F/M",
  "turtle bay": "6, E/M",
  "lenox hill": "6, Q, F",
  yorkville: "4/5/6, Q",
  "carnegie hill": "4/5/6, Q",
  harlem: "2/3, A/B/C/D, 4/5/6",
  "east harlem": "4/5/6, 2/3",
  "hamilton heights": "1, A/B/C/D",
  "washington heights": "1, A/C",
  inwood: "1, A",
  chinatown: "B/D, J/Z, N/Q/R/W, 6, F",
  "little italy": "6, B/D/F/M, J/Z",
  "two bridges": "F, B/D",
  "hudson yards": "7, A/C/E",
  "roosevelt island": "F",
};

export function deriveTransit(neighborhood: string): string {
  const key = neighborhood.trim().toLowerCase();
  return NEIGHBORHOOD_TRAINS[key] ?? "";
}

export const KNOWN_NEIGHBORHOODS = Array.from(
  new Set(
    Object.keys(NEIGHBORHOOD_TRAINS)
      .filter((k) => !k.includes("_"))
      .map((k) =>
        k
          .split(/[\s-]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      )
  )
).sort();
