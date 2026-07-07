# Diesel Route Planner — Research

**The question:** Can we build an app where you enter a start and end point, and it plots every
diesel station within ~2 miles of the freeway along the route, ranked by diesel price — e.g.
Elk Grove, CA → Morro Bay, CA?

**The answer: yes, and almost entirely on Google Maps Platform alone.** Google's newer APIs
have the two pieces that used to be the hard part:

1. **Search Along Route (SAR)** — the Places API (New) Text Search accepts a route polyline and
   returns places along it (`searchAlongRouteParameters`).
2. **Live fuel prices, including diesel** — the Places API (New) returns a `fuelOptions` field for
   gas stations with the last-known price per fuel type: `DIESEL`, `DIESEL_PLUS`, `TRUCK_DIESEL`,
   plus gasoline grades, each with an `updateTime` so you can discard stale data.

That combination means no scraping GasBuddy, no third-party fuel-data contract for an MVP.

---

## Architecture

```
User enters origin + destination
        │
        ▼
1. Routes API  (routes.googleapis.com/directions/v2:computeRoutes)
   → returns encoded polyline, distance, duration
        │
        ▼
2. Places API (New) Text Search  (places.googleapis.com/v1/places:searchText)
   body:  { textQuery: "diesel gas station",
            searchAlongRouteParameters: { polyline: { encodedPolyline } } }
   field mask: places.displayName, places.location, places.formattedAddress,
               places.fuelOptions, places.currentOpeningHours.openNow
   → returns up to 20 stations per call with diesel $/gal + price timestamp
        │
        ▼
3. Client-side filtering (free, no API calls)
   - decode the polyline, compute each station's perpendicular distance to the route
   - drop anything beyond the "max detour" (e.g. 2 miles)
   - compute "miles into the trip" for each station
        │
        ▼
4. Rank by diesel price; render on a map + sortable list;
   optionally compute "smart stop" = cheapest station inside your reachable fuel window
```

### Details & gotchas

- **20-result cap per SAR call.** For a 290-mile route one call clusters results; the fix is to
  slice the route polyline into ~50-mile segments, run one SAR call per segment, and dedupe by
  place ID. Elk Grove → Morro Bay ≈ 6 segments.
- **The 2-mile filter is done locally, not by the API.** SAR ranks by "along the route" but does
  not take a hard detour limit. Point-to-polyline distance is ~30 lines of code (or turf.js
  `nearestPointOnLine`). SAR can also return `routingSummaries` (drive time/distance to each
  result) if you want detour *time* rather than crow-flies distance.
- **Price data coverage:** excellent at branded stations and travel stops (Love's, Pilot, Chevron,
  Shell…), spottier at tiny independents. Always check `fuelOptions.fuelPrices[].updateTime` and
  grey out anything older than ~48h.
- **`TRUCK_DIESEL` vs `DIESEL`:** truck stops often report both (cash/credit lane pricing differs
  too). For a pickup/RV use `DIESEL` and fall back to `TRUCK_DIESEL`.

### Cost (Google Maps Platform, 2026 pricing)

- `fuelOptions` puts the Places call in the **Enterprise SKU (~$35 / 1,000 calls)**; there are
  ~1,000 free Enterprise calls/month.
- Routes API compute is ~$5/1,000.
- **One trip plan ≈ 1 Routes call + ~6 SAR calls ≈ $0.22, i.e. free for personal use** within the
  monthly free tier (~150 trip plans/month before paying anything). A Maps JavaScript map load for
  display is on the Essentials free tier.

### Suggested stack

Next.js (same as this repo) + a single API route that does Routes → chunked SAR → filter, and a
client page with the Maps JS SDK. The whole MVP is a weekend project — see `prototype.html` in
this folder for a working single-file version (bring your own API key with Routes API, Places API
(New), and Maps JavaScript API enabled).

---

## Alternative fuel-price data sources (if Google's isn't enough)

| Source | Notes |
|---|---|
| **TomTom Fuel Prices API** | Real prices refreshed ~every 10 min; US coverage; **not on the free tier** — requires a sales contract. |
| **HERE Fuel Prices API** | Similar; enterprise licensing. |
| **OPIS (a Dow Jones co.)** | The industry-standard feed (it's who most consumer apps license from). Enterprise pricing, overkill for an MVP. |
| **GasBuddy** | **No public API.** Crowdsourced consumer app only. Their site already has a "Trip Cost Calculator" that partially does what we want. |
| **CollectAPI gasPrice** | Cheap hobby-tier API; coarse (city averages, not per-station). |

## Prior art worth knowing before building

- **GasBuddy Trip Cost Calculator** — route + cheapest stations, but weak diesel focus and no detour limit.
- **iExit** (iexitapp.com) — exit-by-exit fuel prices on interstates; closest to the "2 miles off the freeway" idea, but organized by exit, not optimized by price-vs-detour.
- **Mudflap / TruckerPath** — trucker diesel discount apps; great diesel price data but built around commercial cards.

None of them combine *route + hard detour limit + diesel-only price ranking + tank-range window*,
which is exactly the niche this app fills.

---

## The concrete case: Elk Grove → Morro Bay (~290 mi)

Route: I-5 South (~200 mi) → CA-46 West at Lost Hills → Paso Robles (~250 mi) → US-101 S / CA-41 →
Morro Bay. Live per-station prices couldn't be pulled from this environment (GasBuddy/iExit block
automated access), but the corridor's price structure is stable and well documented:

1. **Cheapest fill of the whole trip is before you leave.** Sacramento-metro discounters in/near
   Elk Grove (Safeway Fuel, ARCO, Costco Elk Grove) typically run well under the CA average
   (≈ $6.18/gal diesel, EIA week of Jun 29 2026), while rural I-5 travel stops run above it.
2. **If you must fill en route, do it at Lost Hills (I-5 × CA-46).** There's a Love's Travel Stop
   plus competitors *at the exact exit you're taking anyway* — zero detour — and truck-stop
   competition keeps diesel below the isolated I-5 stops. Santa Nella (~90 mi in, Love's/Pilot/TA
   cluster) is the other competitive cluster.
3. **Paso Robles is the last cheap(ish) fuel.** Fastrip on Creston Rd has historically been the
   cheapest diesel in SLO County (~2 mi off the route).
4. **Avoid:** Kettleman City and Harris Ranch/Coalinga (captive-audience pricing), and anything in
   Morro Bay / coastal SLO County — among the priciest fuel in the state.

Note: at ~290 miles, most diesel vehicles make it on one tank — so the "smart stop" answer is
often simply *leave Elk Grove full, top up at Lost Hills only if needed.*
