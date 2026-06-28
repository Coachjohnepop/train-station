"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  googleMapsApiKey,
  loadGoogleMapsPlaces,
  parseCityStateFromPlace,
} from "@/lib/google-maps-places";

type CityHintResponse = {
  city?: string | null;
  state?: string | null;
  source?: string;
};

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
  const userEditedRef = useRef(false);
  const hintAttemptedRef = useRef(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const hasGoogle = Boolean(googleMapsApiKey());

  useEffect(() => {
    onCityChangeRef.current = onCityChange;
    onStateChangeRef.current = onStateChange;
  });

  const applyHint = useCallback((hint: CityHintResponse, label: string) => {
    if (userEditedRef.current) return;
    if (hint.city) onCityChangeRef.current(hint.city);
    if (hint.state) onStateChangeRef.current(hint.state);
    if (hint.city || hint.state) {
      setHintMessage(label);
    }
  }, []);

  useEffect(() => {
    if (!enabled || hintAttemptedRef.current) return;
    if (city.trim() || state.trim()) return;

    hintAttemptedRef.current = true;
    let cancelled = false;

    void fetch("/api/geo/city-hint", { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CityHintResponse | null) => {
        if (cancelled || !data?.city) return;
        applyHint(
          data,
          "We prefilled your city from your area — change it anytime or pick a Google suggestion.",
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, city, state, applyHint]);

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
        userEditedRef.current = true;
        setHintMessage(null);
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

  async function useDeviceLocation() {
    if (!navigator.geolocation) {
      setHintMessage("Location isn’t available in this browser — type your city instead.");
      return;
    }

    setLocationBusy(true);
    setHintMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300_000,
        });
      });

      const res = await fetch(
        `/api/geo/city-hint?lat=${encodeURIComponent(String(position.coords.latitude))}&lng=${encodeURIComponent(String(position.coords.longitude))}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = (await res.json().catch(() => ({}))) as CityHintResponse;
      if (!res.ok || !data.city) {
        setHintMessage("Couldn’t detect your city — type it or pick a Google suggestion.");
        return;
      }

      userEditedRef.current = false;
      applyHint(data, "Filled from your device location — edit if that’s not right.");
    } catch {
      setHintMessage("Location blocked or unavailable — type your city manually.");
    } finally {
      setLocationBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{cityLabel}</label>
        <input
          ref={cityRef}
          type="text"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => {
            userEditedRef.current = true;
            setHintMessage(null);
            onCityChange(e.target.value);
          }}
          placeholder="e.g. Austin"
          className="input w-full"
        />
        {hasGoogle ? (
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Start typing for Google suggestions, or use your location below — you can always edit manually.
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            We&apos;ll suggest your city from your area when we can — edit anytime.
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{stateLabel}</label>
        <input
          type="text"
          autoComplete="address-level1"
          value={state}
          onChange={(e) => {
            userEditedRef.current = true;
            setHintMessage(null);
            onStateChange(e.target.value.toUpperCase());
          }}
          placeholder="TX"
          maxLength={2}
          className="input w-full uppercase"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="text-xs text-accent hover:underline disabled:opacity-50"
          disabled={locationBusy || !enabled}
          onClick={() => void useDeviceLocation()}
        >
          {locationBusy ? "Detecting location…" : "Use my current location"}
        </button>
      </div>

      {hintMessage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--muted)]">
          {hintMessage}
        </p>
      )}
    </div>
  );
}