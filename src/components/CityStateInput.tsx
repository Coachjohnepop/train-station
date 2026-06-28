"use client";

import { useEffect, useRef } from "react";
import {
  googleMapsApiKey,
  loadGoogleMapsPlaces,
  parseCityStateFromPlace,
} from "@/lib/google-maps-places";

export default function CityStateInput({
  city,
  state,
  onCityChange,
  onStateChange,
  enabled = true,
  cityLabel = "City",
  stateLabel = "State",
}: {
  city: string;
  state: string;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  enabled?: boolean;
  cityLabel?: string;
  stateLabel?: string;
}) {
  const cityRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<object | null>(null);
  const onCityChangeRef = useRef(onCityChange);
  const onStateChangeRef = useRef(onStateChange);
  const hasGoogle = Boolean(googleMapsApiKey());

  useEffect(() => {
    onCityChangeRef.current = onCityChange;
    onStateChangeRef.current = onStateChange;
  });

  useEffect(() => {
    if (!enabled || !hasGoogle || !cityRef.current) return;

    let cancelled = false;

    void loadGoogleMapsPlaces().then((maps) => {
      if (cancelled || !maps?.places || !cityRef.current) return;

      const autocomplete = new maps.places.Autocomplete(cityRef.current, {
        types: ["(cities)"],
        componentRestrictions: { country: "us" },
        fields: ["address_components", "name"],
      });
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const parsed = parseCityStateFromPlace(place);
        if (parsed.city) onCityChangeRef.current(parsed.city);
        if (parsed.state) onStateChangeRef.current(parsed.state);
      });
    });

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [enabled, hasGoogle]);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{cityLabel}</label>
        <input
          ref={cityRef}
          type="text"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="e.g. Austin"
          className="input w-full"
        />
        {hasGoogle ? (
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Start typing — pick a Google suggestion or enter your city manually.
          </p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{stateLabel}</label>
        <input
          type="text"
          autoComplete="address-level1"
          value={state}
          onChange={(e) => onStateChange(e.target.value.toUpperCase())}
          placeholder="TX"
          maxLength={2}
          className="input w-full uppercase"
        />
      </div>
    </div>
  );
}