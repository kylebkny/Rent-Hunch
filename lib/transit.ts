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
