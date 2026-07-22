"use client";

import { useEffect, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

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

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete!.getPlace();
          if (!place.geometry?.location) return;
          const loc = place.geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();

          const comps = place.address_components ?? [];
          const get = (type: string) =>
            comps.find((c) => c.types.includes(type))?.long_name ?? null;
          const neighborhood = get("neighborhood") ?? get("sublocality_level_2");
          const borough = get("sublocality_level_1") ?? get("sublocality") ?? get("locality");

          const svc = new g.maps.places.PlacesService(document.createElement("div"));
          svc.nearbySearch(
            { location: { lat, lng }, rankBy: g.maps.places.RankBy.DISTANCE, type: "subway_station" },
            (results, status) => {
              let transit: string | null = null;
              if (status === g.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.location) {
                const st = results[0];
                const meters = g.maps.geometry.spherical.computeDistanceBetween(
                  loc,
                  st.geometry!.location!
                );
                const min = Math.max(1, Math.round(meters / 80));
                transit = `${st.name} · ${min} min walk`;
              }
              resolveRef.current({
                address: place.formatted_address ?? "",
                lat,
                lng,
                neighborhood,
                borough,
                transit,
              });
            }
          );
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
