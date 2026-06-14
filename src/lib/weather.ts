export type CurrentWeather = {
  city: string;
  state: string;
  temperature: number; // °F
  condition: string;
  weatherCode: number;
  windSpeed: number; // mph
  observedAt: string;
};

/**
 * Geocode city + state to lat/lon using Open-Meteo (free, no key).
 */
export async function geocodeCityState(city: string, state: string): Promise<{ lat: number; lon: number; resolvedName: string } | null> {
  if (!city || !state) return null;

  const query = `${city}, ${state}`.trim();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 * 24 } }); // cache 24h
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    return {
      lat: result.latitude,
      lon: result.longitude,
      resolvedName: `${result.name}, ${result.admin1 || state}`,
    };
  } catch (e) {
    console.error("Geocode failed:", e);
    return null;
  }
}

/**
 * Get current weather from Open-Meteo (free, no key). Returns F, wind mph.
 * weatherCode is WMO code (0=clear, 1-3=partly cloudy, etc.)
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<Omit<CurrentWeather, "city" | "state"> | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 min
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    const code = current.weather_code as number;
    const condition = mapWeatherCode(code);

    return {
      temperature: Math.round(current.temperature_2m),
      weatherCode: code,
      condition,
      windSpeed: Math.round(current.wind_speed_10m),
      observedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("Weather fetch failed:", e);
    return null;
  }
}

function mapWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain Showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Cloudy";
}

/**
 * Full helper: given city/state, returns current weather or null.
 * Logs nothing here — caller decides.
 */
export async function getWeatherForLocation(city: string, state: string): Promise<CurrentWeather | null> {
  const geo = await geocodeCityState(city, state);
  if (!geo) return null;

  const weather = await getCurrentWeather(geo.lat, geo.lon);
  if (!weather) return null;

  return {
    city,
    state,
    ...weather,
  };
}

/**
 * Logs the weather observation for a user (for historical context, instructor review, etc.).
 * In demo mode: console logs only.
 * In real: inserts into UserWeatherLog.
 */
export async function logUserWeather(userId: string, location: { city: string | null; state: string | null }, weather: CurrentWeather | null) {
  if (!location.city && !location.state) return;

  const isDemo = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dummy");

  const logData = {
    userId,
    city: location.city,
    state: location.state,
    temperature: weather?.temperature ?? null,
    weatherCode: weather?.weatherCode ?? null,
    condition: weather?.condition ?? null,
    windSpeed: weather?.windSpeed ?? null,
  };

  if (isDemo) {
    console.log(`[WEATHER LOG - DEMO] user=${userId} | ${location.city}, ${location.state} | ${weather?.temperature}°F ${weather?.condition} | wind ${weather?.windSpeed}mph at ${new Date().toISOString()}`);
    return;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.userWeatherLog.create({
      data: logData,
    });
  } catch (e) {
    console.error("Failed to log weather", e);
  }
}