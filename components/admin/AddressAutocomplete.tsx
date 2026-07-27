"use client";

import { useEffect, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { formatTransitClue } from "@/lib/subway-lines";
import { deriveTransit } from "@/lib/transit";

export interface ResolvedAddress {
  address: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  borough: string | null;
  transit: string | null;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// Rough NYC bounds to bias autocomplete.
const NYC_BOUNDS = { north: 40.92, south: 40.49, east: -73.68, west: -74.28 };

/** Neighborhood/borough out of Google's address components. */
function readComponents(comps: google.maps.GeocoderAddressComponent[]) {
  const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name ?? null;
  return {
    neighborhood: get("neighborhood") ?? get("sublocality_level_2"),
    borough: get("sublocality_level_1") ?? get("sublocality") ?? get("locality"),
  };
}

/**
 * Nearest subway station to a point, as "L, G · Lorimer St · 4 min walk".
 * Google gives us the station name but not which trains stop there, so the
 * lines come from our own station index (`fallbackLines` covers stations it
 * doesn't know).
 */
function nearestSubway(loc: google.maps.LatLng, fallbackLines = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const g = window.google;
    const svc = new g.maps.places.PlacesService(document.createElement("div"));
    svc.nearbySearch(
      { location: loc, rankBy: g.maps.places.RankBy.DISTANCE, type: "subway_station" },
      (results, status) => {
        if (status !== g.maps.places.PlacesServiceStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const st = results[0];
        const meters = g.maps.geometry.spherical.computeDistanceBetween(loc, st.geometry!.location!);
        resolve(formatTransitClue(st.name ?? "", Math.max(1, Math.round(meters / 80)), fallbackLines));
      }
    );
  });
}

/**
 * Geocode a plain address string (e.g. one recovered from a StreetEasy link)
 * into the same shape the autocomplete produces. Resolves null when Maps
 * isn't configured or the address can't be found.
 */
export async function geocodeAddress(address: string): Promise<ResolvedAddress | null> {
  if (!KEY || !address.trim()) return null;
  try {
    setOptions({ key: KEY, v: "weekly" });
    await Promise.all([importLibrary("places"), importLibrary("geometry"), importLibrary("geocoding")]);
    const g = window.google;
    const geocoder = new g.maps.Geocoder();
    const { results } = await geocoder.geocode({
      address,
      componentRestrictions: { country: "us" },
      bounds: NYC_BOUNDS,
    });
    const place = results?.[0];
    if (!place?.geometry?.location) return null;
    const loc = place.geometry.location;
    const { neighborhood, borough } = readComponents(place.address_components ?? []);
    return {
      address: place.formatted_address ?? address,
      lat: loc.lat(),
      lng: loc.lng(),
      neighborhood,
      borough,
      transit: await nearestSubway(loc, deriveTransit(neighborhood ?? "")),
    };
  } catch {
    return null;
  }
}

/**
 * Google Places address search for the admin. On selection it geocodes the
 * address, derives the neighborhood/borough from address components, finds
 * the nearest subway station (with a walk-time estimate), and hands it all
 * back. Renders nothing (manual entry only) when no API key is configured.
 */
export function AddressAutocomplete({ onResolve }: { onResolve: (r: ResolvedAddress) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveRef = useRef(onResolve);

  useEffect(() => {
    resolveRef.current = onResolve;
  }, [onResolve]);

  useEffect(() => {
    if (!KEY || !inputRef.current) return;
    let autocomplete: google.maps.places.Autocomplete | undefined;
    let cancelled = false;

    setOptions({ key: KEY, v: "weekly" });

    Promise.all([importLibrary("places"), importLibrary("geometry")])
      .then(async () => {
        if (cancelled || !inputRef.current) return;
        const g = window.google;

        autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "address_components"],
          componentRestrictions: { country: "us" },
          bounds: NYC_BOUNDS,
          types: ["address"],
        });

        autocomplete.addListener("place_changed", async () => {
          const place = autocomplete!.getPlace();
          if (!place.geometry?.location) return;
          const loc = place.geometry.location;
          const { neighborhood, borough } = readComponents(place.address_components ?? []);
          resolveRef.current({
            address: place.formatted_address ?? "",
            lat: loc.lat(),
            lng: loc.lng(),
            neighborhood,
            borough,
            transit: await nearestSubway(loc, deriveTransit(neighborhood ?? "")),
          });
        });
      })
      .catch(() => {
        // Loader failed (bad key, API not enabled) — manual entry still works.
      });

    return () => {
      cancelled = true;
      if (autocomplete && window.google) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, []);

  if (!KEY) return null;

  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">Search address (autofills neighborhood, borough, train)</span>
      <input
        ref={inputRef}
        placeholder="Start typing an address…"
        className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:border-ink bg-paper"
      />
    </label>
  );
}
