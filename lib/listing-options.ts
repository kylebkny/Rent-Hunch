// Shared option lists for the admin form, so entry is mostly selection
// rather than free typing — keeps data consistent across listings.

export const BOROUGHS = ["Brooklyn", "Queens", "Manhattan", "Bronx", "Staten Island"];

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
  { value: 2, label: "2 bath" },
  { value: 3, label: "3 bath" },
  { value: 4, label: "4+ bath" },
];
