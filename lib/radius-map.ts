/**
 * Geometry for the hint token's "radius map" — a Static Maps API image
 * showing a circle around a *jittered* point, never the listing's real
 * lat/lng, so the true building can't be read off (or triangulated by
 * spending the token more than once and comparing circles — the jitter is
 * computed once per puzzle and persisted, see app/api/hint/route.ts).
 *
 * Pure/no secrets here on purpose: no "server-only" guard needed, and it
 * keeps this testable with node:test the same way lib/guess-slider.ts and
 * lib/photo-reveal.ts are.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * METERS_PER_DEG_LAT;
  const dLng = (a.lng - b.lng) * metersPerDegLng((a.lat + b.lat) / 2);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Jitter magnitude, in degrees, per the spec ("roughly 1-2 blocks").
export const JITTER_MIN_DEG = 0.001;
export const JITTER_MAX_DEG = 0.002;

// The circle drawn on the map. Worst-case jitter distance is
// JITTER_MAX_DEG applied entirely along latitude (the "bigger" degree in
// meters), ~0.002 * 111,320 ≈ 223m — this radius leaves a wide margin
// above that so the true building always falls well inside the circle,
// however the jitter lands, at any NYC latitude.
export const RADIUS_METERS = 500;

/**
 * A random point within [JITTER_MIN_DEG, JITTER_MAX_DEG] of `center`, in a
 * random direction. `rng` is injectable so tests can drive it
 * deterministically; defaults to Math.random. Meant to be called once per
 * puzzle and persisted — calling it fresh on every request would let
 * repeated reveals be triangulated against each other.
 */
export function jitterPoint(center: LatLng, rng: () => number = Math.random): LatLng {
  const angle = rng() * 2 * Math.PI;
  const magnitude = JITTER_MIN_DEG + rng() * (JITTER_MAX_DEG - JITTER_MIN_DEG);
  return {
    lat: center.lat + magnitude * Math.sin(angle),
    lng: center.lng + magnitude * Math.cos(angle),
  };
}

/**
 * Points approximating a circle of `radiusMeters` around `center`, for use
 * as a Static Maps `path=` polygon (the API has no native circle
 * primitive). Closed automatically: the first and last points coincide.
 */
export function circlePathPoints(center: LatLng, radiusMeters: number, numPoints = 40): LatLng[] {
  const latPerMeter = 1 / METERS_PER_DEG_LAT;
  const lngPerMeter = 1 / metersPerDegLng(center.lat);
  const points: LatLng[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    points.push({
      lat: center.lat + radiusMeters * latPerMeter * Math.sin(theta),
      lng: center.lng + radiusMeters * lngPerMeter * Math.cos(theta),
    });
  }
  return points;
}

/**
 * A Google Static Maps URL showing the circle, auto-framed to the path's
 * bounding box (no explicit center/zoom, so the whole circle is always in
 * frame regardless of radius) — deliberately no `markers=`, so there's no
 * pin at the jittered point either.
 */
export function buildRadiusMapUrl(
  center: LatLng,
  opts: { apiKey: string; size?: string; radiusMeters?: number }
): string {
  const points = circlePathPoints(center, opts.radiusMeters ?? RADIUS_METERS);
  const path = [
    "color:0x1a1a1acc",
    "weight:2",
    "fillcolor:0x1a1a1a1a",
    ...points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`),
  ].join("|");
  const params = new URLSearchParams({
    size: opts.size ?? "600x400",
    maptype: "roadmap",
    key: opts.apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&path=${encodeURIComponent(path)}`;
}
