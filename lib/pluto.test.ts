import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupYearBuilt } from "./pluto-core";

/**
 * lookupYearBuilt talks to the network directly, so these tests stub
 * globalThis.fetch with fixture SODA responses (JSON arrays of rows, same
 * shape the live API returns) rather than hitting the real endpoint —
 * same fixture-in/parsed-value-out spirit as lib/streeteasy.test.ts,
 * applied to an HTTP boundary instead of an HTML one.
 */
function stubFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const { ok, body } = handler(url);
    return {
      ok,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("lookupYearBuilt: matches by address and reads the yearbuilt field", async () => {
  const restore = stubFetch(() => ({
    ok: true,
    body: [{ address: "500 WEST 21 STREET", yearbuilt: "1920" }],
  }));
  try {
    const year = await lookupYearBuilt({ address: "500 West 21st Street" });
    assert.equal(year, 1920);
  } finally {
    restore();
  }
});

test("lookupYearBuilt: re-ranks $q results by house number when multiple come back", async () => {
  const restore = stubFetch(() => ({
    ok: true,
    body: [
      { address: "502 WEST 21 STREET", yearbuilt: "1999" },
      { address: "500 WEST 21 STREET", yearbuilt: "1920" },
    ],
  }));
  try {
    const year = await lookupYearBuilt({ address: "500 West 21st Street" });
    assert.equal(year, 1920);
  } finally {
    restore();
  }
});

test("lookupYearBuilt: falls back to lat/lng when address has no match", async () => {
  let calls = 0;
  const restore = stubFetch((url) => {
    calls++;
    if (url.includes("%24q=")) return { ok: true, body: [] }; // address ($q) miss
    return { ok: true, body: [{ latitude: "40.7", longitude: "-74.0", yearbuilt: "1955" }] };
  });
  try {
    const year = await lookupYearBuilt({ address: "Nowhere Ave", lat: 40.7, lng: -74.0 });
    assert.equal(year, 1955);
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

test("lookupYearBuilt: 0 (PLUTO's 'unknown' sentinel) resolves to null, not 0", async () => {
  const restore = stubFetch(() => ({
    ok: true,
    body: [{ address: "1 NOWHERE STREET", yearbuilt: "0" }],
  }));
  try {
    const year = await lookupYearBuilt({ address: "1 Nowhere Street" });
    assert.equal(year, null);
  } finally {
    restore();
  }
});

test("lookupYearBuilt: implausible values (typos, future years) resolve to null", async () => {
  const restore = stubFetch(() => ({
    ok: true,
    body: [{ address: "1 NOWHERE STREET", yearbuilt: "9999" }],
  }));
  try {
    assert.equal(await lookupYearBuilt({ address: "1 Nowhere Street" }), null);
  } finally {
    restore();
  }
});

test("lookupYearBuilt: no rows, no input, HTTP error, and network failure all resolve to null (never throw)", async () => {
  assert.equal(await lookupYearBuilt({}), null);

  let restore = stubFetch(() => ({ ok: true, body: [] }));
  try {
    assert.equal(await lookupYearBuilt({ address: "1 Nowhere Street" }), null);
  } finally {
    restore();
  }

  restore = stubFetch(() => ({ ok: false, body: null }));
  try {
    assert.equal(await lookupYearBuilt({ address: "1 Nowhere Street" }), null);
  } finally {
    restore();
  }

  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  try {
    assert.equal(await lookupYearBuilt({ address: "1 Nowhere Street" }), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("lookupYearBuilt: accepts alternate year-field casing defensively", async () => {
  const restore = stubFetch(() => ({
    ok: true,
    body: [{ address: "1 NOWHERE STREET", year_built: "1888" }],
  }));
  try {
    assert.equal(await lookupYearBuilt({ address: "1 Nowhere Street" }), 1888);
  } finally {
    restore();
  }
});
