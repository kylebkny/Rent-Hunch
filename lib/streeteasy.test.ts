import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStreetEasyUrl, parseListingHtml } from "./streeteasy";

test("parseStreetEasyUrl: hyphenated borough token", () => {
  const parts = parseStreetEasyUrl("https://streeteasy.com/building/119-north-11-street-brooklyn/3c");
  assert.deepEqual(parts, {
    address: "119 North 11 Street",
    unit: "3C",
    borough: "Brooklyn",
    canonicalUrl: "https://streeteasy.com/building/119-north-11-street-brooklyn/3c",
  });
});

// Regression: some StreetEasy slugs separate the borough token with an
// underscore instead of a hyphen (e.g. "…-new_york"). Before the fix this
// left `borough` null and left the stray "New_york" token stuck onto the
// end of `address`, which in turn corrupted the address handed to the
// client-side geocoder and silently starved the neighborhood field.
test("parseStreetEasyUrl: underscore-separated borough token", () => {
  const parts = parseStreetEasyUrl(
    "https://streeteasy.com/building/500-west-21st-street-new_york/garden-a?utm_source=web"
  );
  assert.deepEqual(parts, {
    address: "500 West 21st Street",
    unit: "GARDEN-A",
    borough: "Manhattan",
    canonicalUrl: "https://streeteasy.com/building/500-west-21st-street-new_york/garden-a",
  });
});

test("parseStreetEasyUrl: underscore borough token matches its hyphenated equivalent", () => {
  const underscored = parseStreetEasyUrl(
    "https://streeteasy.com/building/123-45-street-staten_island/1a"
  );
  const hyphenated = parseStreetEasyUrl(
    "https://streeteasy.com/building/123-45-street-staten-island/1a"
  );
  assert.equal(underscored?.address, hyphenated?.address);
  assert.equal(underscored?.borough, hyphenated?.borough);
  assert.equal(underscored?.borough, "Staten Island");
});

test("parseStreetEasyUrl: named building has no address to geocode", () => {
  const parts = parseStreetEasyUrl("https://streeteasy.com/building/the-nathaniel/12b");
  assert.equal(parts?.address, null);
  assert.equal(parts?.unit, "12B");
});

test("parseStreetEasyUrl: opaque rental id has nothing to read from the slug", () => {
  const parts = parseStreetEasyUrl("https://streeteasy.com/rental/1234567");
  assert.deepEqual(parts, {
    address: null,
    unit: null,
    borough: null,
    canonicalUrl: "https://streeteasy.com/rental/1234567",
  });
});

test("parseListingHtml: longest whitelist match wins over a shorter substring", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="1 Bed in East Flatbush" />
      <meta property="og:description" content="Sunny 1 bed in East Flatbush, Brooklyn. $2,800/mo." />
    </head><body>Rent $2,800/mo. 1 bed, 1 bath.</body></html>
  `;
  const fields = parseListingHtml(html);
  assert.equal(fields.neighborhood, "East Flatbush");
  assert.equal(fields.borough, "Brooklyn");
  assert.equal(fields.rent, 2800);
});

test("parseListingHtml: falls back to \"in X, Borough\" copy when not in the whitelist", () => {
  const html = `
    <html><head>
      <meta property="og:description" content="Charming studio in Vinegar Hill, Brooklyn." />
    </head><body>Studio apartment.</body></html>
  `;
  const fields = parseListingHtml(html);
  assert.equal(fields.neighborhood, "Vinegar Hill");
  assert.equal(fields.borough, "Brooklyn");
});

test("parseListingHtml: JSON-LD address feeds address/borough independent of the neighborhood match", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        ${JSON.stringify({
          "@type": "Apartment",
          address: { streetAddress: "500 West 21st Street", addressLocality: "New York" },
          offers: { price: 5200 },
          numberOfBedrooms: 1,
          numberOfBathroomsTotal: 1,
        })}
      </script>
      <meta property="og:description" content="Located in Chelsea, Manhattan." />
    </head><body></body></html>
  `;
  const fields = parseListingHtml(html);
  assert.equal(fields.address, "500 West 21st Street");
  assert.equal(fields.rent, 5200);
  assert.equal(fields.neighborhood, "Chelsea");
});
