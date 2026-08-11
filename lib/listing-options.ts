// Shared option lists for the admin form, so entry is mostly selection
// rather than free typing — keeps data consistent across listings.

export const BOROUGHS = ["Brooklyn", "Manhattan", "Queens", "Bronx", "Staten Island"];

export const BROOKLYN_NEIGHBORHOODS = [
  "Williamsburg", "Greenpoint", "Bushwick", "Bedford-Stuyvesant", "Bed-Stuy",
  "Clinton Hill", "Fort Greene", "Prospect Heights", "Crown Heights",
  "Park Slope", "Gowanus", "Carroll Gardens", "Cobble Hill", "Boerum Hill",
  "Downtown Brooklyn", "Brooklyn Heights", "DUMBO", "Vinegar Hill",
  "Prospect Lefferts Gardens", "Flatbush", "Ditmas Park", "East Flatbush",
  "Kensington", "Windsor Terrace", "Sunset Park", "Bay Ridge", "Bensonhurst",
  "Borough Park", "Dyker Heights", "Red Hook", "Sheepshead Bay",
  "Brighton Beach", "Coney Island", "Canarsie", "Brownsville", "East New York",
  "Marine Park", "Flatlands",
];

export const MANHATTAN_NEIGHBORHOODS = [
  "Upper East Side", "Upper West Side", "Midtown", "Midtown East",
  "Hell's Kitchen", "Chelsea", "Greenwich Village", "West Village",
  "East Village", "Lower East Side", "SoHo", "NoHo", "Nolita", "Tribeca",
  "Financial District", "Battery Park City", "Gramercy", "Flatiron",
  "Union Square", "Murray Hill", "Kips Bay", "NoMad", "Turtle Bay",
  "Lenox Hill", "Yorkville", "Carnegie Hill", "Morningside Heights",
  "Harlem", "East Harlem", "Hamilton Heights", "Washington Heights",
  "Inwood", "Chinatown", "Little Italy", "Two Bridges", "Hudson Yards",
  "Roosevelt Island",
];

// Brooklyn and Manhattan are the focus, but the game isn't limited to them —
// these round out the other boroughs so an Astoria or Staten Island listing
// (imported or EXR-synced) gets the same reliable neighborhood match as a
// Brooklyn one, instead of depending on page copy happening to say "in X,
// Borough" verbatim. Queens/Bronx names mirror lib/exr/scraper.ts's own list
// so the two ingestion paths agree on spelling; EXR doesn't cover Staten
// Island at all, so that list is sourced independently.
export const QUEENS_NEIGHBORHOODS = [
  "Astoria", "Long Island City", "Flushing", "Jackson Heights", "Forest Hills",
  "Jamaica", "Bayside", "Sunnyside", "Woodside", "Corona", "Elmhurst",
  "Rego Park", "Maspeth", "Glendale", "Middle Village", "Ridgewood",
  "Ozone Park", "Richmond Hill", "South Ozone Park", "Springfield Gardens",
];

export const BRONX_NEIGHBORHOODS = [
  "South Bronx", "Fordham", "Riverdale", "Pelham", "Mott Haven",
  "Concourse", "Tremont", "Belmont", "Norwood", "Port Morris",
];

export const STATEN_ISLAND_NEIGHBORHOODS = [
  "St. George", "Stapleton", "Tompkinsville", "New Brighton", "West Brighton",
  "Great Kills", "Tottenville", "New Dorp", "Port Richmond",
];

// Combined list for the neighborhood typeahead.
export const NYC_NEIGHBORHOODS = [
  ...BROOKLYN_NEIGHBORHOODS,
  ...MANHATTAN_NEIGHBORHOODS,
  ...QUEENS_NEIGHBORHOODS,
  ...BRONX_NEIGHBORHOODS,
  ...STATEN_ISLAND_NEIGHBORHOODS,
];

export const AMENITY_OPTIONS = [
  "Dishwasher", "In-unit Laundry", "Laundry in Building", "Elevator",
  "Doorman", "Fitness Center", "Roof Deck", "Private Outdoor Space",
  "Balcony", "Backyard", "Hardwood Floors", "Stainless Appliances",
  "Central AC", "Pets Allowed", "Parking", "Live-in Super", "Storage",
  "Recently Renovated", "No Fee",
];

export const BED_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1 bed" },
  { value: 2, label: "2 bed" },
  { value: 3, label: "3 bed" },
  { value: 4, label: "4 bed" },
  { value: 5, label: "5+ bed" },
];

export const BATH_OPTIONS = [
  { value: 1, label: "1 bath" },
  { value: 1.5, label: "1.5 bath" },
  { value: 2, label: "2 bath" },
  { value: 2.5, label: "2.5 bath" },
  { value: 3, label: "3 bath" },
  { value: 3.5, label: "3.5 bath" },
  { value: 4, label: "4+ bath" },
];

/** "1 bath" / "1.5 baths" — trims a trailing .0 and pluralizes. */
export function formatBaths(baths: number): string {
  const n = Number(baths);
  const label = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${label} ${n === 1 ? "bath" : "baths"}`;
}

/** "1bd/1.5ba" style short label used in admin lists. */
export function formatBedsBaths(beds: number, baths: number): string {
  const b = Number(baths);
  return `${beds === 0 ? "Studio" : `${beds}bd`}/${Number.isInteger(b) ? b : b.toFixed(1)}ba`;
}
