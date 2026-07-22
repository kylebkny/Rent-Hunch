/**
 * One-line "vibe" descriptors for Brooklyn neighborhoods, shown alongside
 * the neighborhood clue so players who don't know NYC can still gauge how
 * desirable (and therefore expensive) an area is likely to be.
 */
const NEIGHBORHOOD_VIBES: Record<string, string> = {
  williamsburg: "Trendy, waterfront, nightlife — one of Brooklyn's priciest",
  greenpoint: "Polish roots, artsy, waterfront — upscale and rising",
  "bushwick": "Artsy, industrial, big nightlife — hip but more affordable",
  "bedford-stuyvesant": "Historic brownstones, rapidly gentrifying",
  "bed-stuy": "Historic brownstones, rapidly gentrifying",
  "clinton hill": "Leafy, brownstones, near Pratt — well-to-do",
  "fort greene": "Elegant, park-side, cultural — upscale",
  "prospect heights": "Central, near the park & Barclays — desirable",
  "crown heights": "Diverse, brownstones, gentrifying — mid-range",
  "park slope": "Family favorite, park-side, stroller central — pricey",
  gowanus: "Post-industrial, new development, canal-side",
  "carroll gardens": "Italian heritage, charming, quiet — expensive",
  "cobble hill": "Quaint, boutique-lined, affluent",
  "boerum hill": "Brownstone charm, central — upscale",
  "downtown brooklyn": "High-rises, transit hub, busy — pricey new builds",
  "brooklyn heights": "Historic, waterfront promenade — very expensive",
  dumbo: "Cobblestones, waterfront, tech & lofts — premium",
  "vinegar hill": "Tiny, historic, tucked-away — quiet and pricey",
  "prospect lefferts gardens": "Park-side, diverse, Victorian homes — value",
  flatbush: "Diverse, bustling, more affordable",
  "ditmas park": "Victorian houses, leafy, family-friendly",
  "east flatbush": "Residential, Caribbean community — affordable",
  kensington: "Quiet, diverse, residential — value",
  "windsor terrace": "Sleepy, park-adjacent, family — mid-range",
  "sunset park": "Chinatown & Latino community, industrial waterfront — affordable",
  "bay ridge": "Suburban feel, waterfront, family — mid-range",
  bensonhurst: "Residential, Italian & Asian community — affordable",
  "borough park": "Orthodox Jewish community, residential — affordable",
  "dyker heights": "Suburban, famous holiday lights — mid-range",
  "red hook": "Isolated, industrial-chic, waterfront — quirky",
  "sheepshead bay": "Coastal, residential, diverse — affordable",
  "brighton beach": "Russian community, boardwalk — affordable",
  "coney island": "Boardwalk & amusements, beachy — affordable",
  canarsie: "Far-out, residential, quiet — affordable",
  brownsville: "Residential, historically underinvested — most affordable",
  "east new york": "Far east, residential, up-and-coming — affordable",
  "marine park": "Suburban, park & golf, family — mid-range",
  flatlands: "Quiet, residential, suburban feel — affordable",
};

export function describeNeighborhood(neighborhood: string): string | null {
  return NEIGHBORHOOD_VIBES[neighborhood.trim().toLowerCase()] ?? null;
}
