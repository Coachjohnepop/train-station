type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type ParsedCityState = {
  city: string;
  state: string;
};

export function googleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || undefined;
}

export function parseCityStateFromPlace(place: {
  address_components?: AddressComponent[];
  name?: string;
}): ParsedCityState {
  const components = place.address_components ?? [];
  let city = "";
  let state = "";

  for (const component of components) {
    if (component.types.includes("locality")) {
      city = component.long_name;
    } else if (!city && component.types.includes("postal_town")) {
      city = component.long_name;
    } else if (!city && component.types.includes("administrative_area_level_3")) {
      city = component.long_name;
    } else if (component.types.includes("administrative_area_level_1")) {
      state = component.short_name.toUpperCase();
    }
  }

  if (!city && place.name) {
    city = place.name.replace(/,.*$/, "").trim();
  }

  return { city, state };
}

type GoogleMapsNamespace = {
  maps: {
    places: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts?: {
          types?: string[];
          componentRestrictions?: { country: string | string[] };
          fields?: string[];
        },
      ) => {
        addListener: (event: string, handler: () => void) => void;
        getPlace: () => {
          address_components?: AddressComponent[];
          name?: string;
        };
      };
    };
    event: {
      clearInstanceListeners: (instance: object) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
  }
}

let mapsLoadPromise: Promise<GoogleMapsNamespace["maps"] | null> | null = null;

export function loadGoogleMapsPlaces(): Promise<GoogleMapsNamespace["maps"] | null> {
  const key = googleMapsApiKey();
  if (!key || typeof window === "undefined") return Promise.resolve(null);

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps);
  }

  if (!mapsLoadPromise) {
    mapsLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="places"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google!.maps));
        existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
        return;
      }

      const script = document.createElement("script");
      script.dataset.googleMaps = "places";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => resolve(window.google?.maps ?? null);
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });
  }

  return mapsLoadPromise;
}