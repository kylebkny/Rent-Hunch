import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceMeters,
  jitterPoint,
  circlePathPoints,
  buildRadiusMapUrl,
  RADIUS_METERS,
  JITTER_MIN_DEG,
  JITTER_MAX_DEG,
  type LatLng,
} from "./radius-map";

// NYC spans roughly 40.49-40.92 N.
const NYC_LATITUDES = [40.5, 40.7, 40.9];

test("jitterPoint: the true point always falls well inside the drawn circle", () => {
  for (const lat of NYC_LATITUDES) {
    const center: LatLng = { lat, lng: -73.95 };
    for (let i = 0; i < 500; i++) {
      const jittered = jitterPoint(center);
      const dist = distanceMeters(center, jittered);
      assert.ok(
        dist < RADIUS_METERS,
        `true point ${dist.toFixed(1)}m from jittered center at lat ${lat}, radius is ${RADIUS_METERS}m`
      );
    }
  }
});

test("jitterPoint: honors an injected rng deterministically", () => {
  const center: LatLng = { lat: 40.7, lng: -73.95 };
  // angle = 0 (rng() -> 0 first call), magnitude = max (rng() -> 1 second call)
  const calls = [0, 1];
  let i = 0;
  const rng = () => calls[i++];
  const jittered = jitterPoint(center, rng);
  // angle 0 -> pure +lng direction (cos(0)=1, sin(0)=0), full JITTER_MAX_DEG.
  assert.ok(Math.abs(jittered.lat - center.lat) < 1e-9);
  assert.ok(Math.abs(jittered.lng - (center.lng + JITTER_MAX_DEG)) < 1e-9);
});

test("jitterPoint: never produces a zero offset in practice (min magnitude is nonzero)", () => {
  const center: LatLng = { lat: 40.7, lng: -73.95 };
  const jittered = jitterPoint(center, () => 0); // angle 0, magnitude = JITTER_MIN_DEG
  assert.ok(Math.abs(jittered.lng - (center.lng + JITTER_MIN_DEG)) < 1e-9);
  assert.ok(distanceMeters(center, jittered) > 0);
});

test("distanceMeters: zero for coincident points, symmetric otherwise", () => {
  const a: LatLng = { lat: 40.7, lng: -73.95 };
  const b: LatLng = { lat: 40.71, lng: -73.94 };
  assert.equal(distanceMeters(a, a), 0);
  assert.ok(Math.abs(distanceMeters(a, b) - distanceMeters(b, a)) < 1e-9);
});

test("circlePathPoints: closed loop, every point at the target radius", () => {
  const center: LatLng = { lat: 40.7, lng: -73.95 };
  const radius = 500;
  const points = circlePathPoints(center, radius, 40);
  assert.equal(points.length, 41); // 0..40 inclusive, closes the loop
  assert.ok(
    Math.abs(points[0].lat - points[points.length - 1].lat) < 1e-9 &&
      Math.abs(points[0].lng - points[points.length - 1].lng) < 1e-9,
    "first and last point should coincide"
  );
  for (const p of points) {
    const d = distanceMeters(center, p);
    assert.ok(Math.abs(d - radius) < 1, `point at ${d}m, expected ~${radius}m`);
  }
});

test("buildRadiusMapUrl: no markers param (no pin), includes the path and key", () => {
  const url = buildRadiusMapUrl({ lat: 40.7, lng: -73.95 }, { apiKey: "test-key" });
  assert.ok(url.startsWith("https://maps.googleapis.com/maps/api/staticmap?"));
  assert.ok(!url.includes("markers="), "must not include a marker/pin");
  assert.ok(url.includes("key=test-key"));
  assert.ok(url.includes("path="));
  // No explicit center/zoom -- framing comes from the path's bounding box.
  assert.ok(!url.includes("center="));
  assert.ok(!url.includes("zoom="));
});

test("buildRadiusMapUrl: never embeds the true (un-jittered) center literally when a jittered one is passed", () => {
  const trueCenter: LatLng = { lat: 40.7128, lng: -73.9977 };
  const jittered = jitterPoint(trueCenter, () => 0.3); // arbitrary fixed rng
  const url = buildRadiusMapUrl(jittered, { apiKey: "test-key" });
  assert.ok(!url.includes(trueCenter.lat.toFixed(6)));
  assert.ok(!url.includes(trueCenter.lng.toFixed(6)));
});
