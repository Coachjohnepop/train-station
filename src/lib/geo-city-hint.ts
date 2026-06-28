import "server-only";

export type CityHintSource = "vercel-ip" | "ip-api" | "open-meteo" | "none";

export type CityHint = {
  city: string;
  state: string;
  source: CityHintSource;
};

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

export function normalizeUsStateCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return US_STATE_NAME_TO_CODE[trimmed.toLowerCase()] || upper.slice(0, 2);
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;
  if (!candidate || isPrivateIp(candidate)) return null;
  return candidate;
}

function cityHintFromVercelHeaders(request: Request): CityHint | null {
  const country = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  const city = request.headers.get("x-vercel-ip-city")?.trim();
  const region = request.headers.get("x-vercel-ip-country-region")?.trim();
  if (country !== "US" || !city || !region) return null;

  const state = normalizeUsStateCode(region);
  if (!state) return null;
  return { city, state, source: "vercel-ip" };
}

async function cityHintFromIpApi(ip: string): Promise<CityHint | null> {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      country_code?: string;
      city?: string;
      region_code?: string;
      region?: string;
      error?: boolean;
    };
    if (data.error || data.country_code !== "US" || !data.city) return null;
    const state = normalizeUsStateCode(data.region_code || data.region || "");
    if (!state) return null;
    return { city: data.city, state, source: "ip-api" };
  } catch {
    return null;
  }
}

export async function cityHintFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<CityHint | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: Array<{
        name?: string;
        admin1?: string;
        country_code?: string;
      }>;
    };

    const hit = data.results?.[0];
    if (!hit || hit.country_code !== "US" || !hit.name) return null;
    const state = normalizeUsStateCode(hit.admin1 || "");
    if (!state) return null;
    return { city: hit.name, state, source: "open-meteo" };
  } catch {
    return null;
  }
}

/** Best-effort US city/state from Vercel edge headers or IP geolocation. */
export async function cityHintFromRequest(request: Request): Promise<CityHint | null> {
  const fromVercel = cityHintFromVercelHeaders(request);
  if (fromVercel) return fromVercel;

  const ip = clientIpFromRequest(request);
  if (!ip) return null;
  return cityHintFromIpApi(ip);
}