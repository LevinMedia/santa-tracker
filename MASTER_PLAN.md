# 🎅 Santa Tracker — Master Plan

A real-time Santa tracking application that follows Santa's journey around the world on Christmas Eve using deterministic timezone-based routing.

## Overview

Santa visits every city in the world during a ~27 hour window, starting at UTC+14 (first to hit midnight) and ending at UTC-12. The route is deterministic: cities are grouped by timezone offset, sorted by latitude, and visited in a snake pattern (alternating north→south, south→north).

---

## 🧠 Core Architecture Principle

### The flight is computed, not stored.

Santa's position is **calculated from the current time**, not fetched from a database. This means:

- **No database queries** during the flight
- **No websockets** or polling needed
- **Every user sees the same position** at the same moment
- **Works offline** once the page loads
- **Instant** — pure math, no network latency

```
User visits site
      ↓
Get current time: Date.now()
      ↓
Calculate: getVisitedCountAt(utcNow)
      ↓
Return: "Santa is at city #23,847"
      ↓
UI updates via setInterval (every second)
```

The **route is static** (pre-computed JSON). The **position is dynamic** (calculated from clock).

---

## Phase 1 — Build the City Dataset ✅

### 1. Download the SimpleMaps Dataset ✅

**Done!** → `public/worldcities.csv` (48,060 cities)

Fields available:
```
city, city_ascii, lat, lng, country, iso2, iso3, admin_name, capital, population, id
```

### 2. Normalize Fields

Keep only what we need:

```
id
city
lat
lng
country
iso2
population
timezone
offset
```

### 3. Add Timezone

Use `tz-lookup` (npm package) to get IANA timezone from coordinates:

```ts
import tzlookup from "tz-lookup";

city.timezone = tzlookup(city.lat, city.lng);
// e.g. "Europe/Paris", "America/Chicago"
```

### 4. Compute UTC Offset for Dec 25

Offsets change with DST, so compute for the actual event date:

```ts
import { DateTime } from "luxon";

const dt = DateTime.fromISO("2025-12-25T00:00:00", { zone: city.timezone });
city.offset = dt.offset / 60; // hours (may be fractional)
```

---

## Phase 2 — Precompute Santa's Global Route

### 5. Group Cities by Timezone Offset

```ts
const zones = groupBy(cityData, c => c.offset)
  .sort((a, b) => b.offset - a.offset); // east → west
```

### 6. Sort Each Zone by Latitude

```ts
// northern first (higher latitude)
cities.sort((a, b) => b.lat - a.lat);
```

### 7. Apply Snake Pattern

For zone index `i`:
- **Even index**: north → south
- **Odd index**: south → north (reverse)

Result:
```
[TZ +14 north→south] → [TZ +13 south→north] → [TZ +12 north→south] → ... → TZ -12
```

### 8. Flatten into Final Route

```ts
const route = zones.flatMap(z => z.cities);
```

This is the **global ordered list of all ~48k cities**.

---

## Phase 3 — Compute Midnight Windows per Timezone

### 9. Calculate Start + End UTC for Each Zone

Each timezone's local midnight maps to a specific UTC time:

```ts
const localMidnight = DateTime.fromISO("2025-12-25T00:00:00", { zone: tz });

zone.windowStartUTC = localMidnight.toUTC();
zone.windowEndUTC = localMidnight.plus({ hours: 1 }).toUTC();
```

---

## Phase 4 — Calculate Santa's Pace per Timezone

### 10. Time per City Inside Each Zone

```ts
zone.timePerCityMs = 3600_000 / zone.cities.length;
```

The global window spans:
- **Start**: UTC+14's midnight (Dec 24 ~10:00 UTC)
- **End**: UTC-12's midnight+1h (Dec 26 ~13:00 UTC)
- **Total**: ~27 hours

---

## Phase 5 — Build Real-Time Engine

### 11. Function: `getVisitedCountAt(utcNow)`

```ts
function getVisitedCountAt(utcNow: Date): number {
  let visited = 0;
  
  for (const zone of zones) {
    if (utcNow < zone.windowStartUTC) {
      // Haven't reached this zone yet
      break;
    }
    
    if (utcNow >= zone.windowEndUTC) {
      // Completed this zone
      visited += zone.cities.length;
      continue;
    }
    
    // Currently in this zone's midnight hour
    const elapsed = utcNow - zone.windowStartUTC;
    const visitedHere = Math.floor(elapsed / zone.timePerCityMs);
    visited += visitedHere;
    break;
  }
  
  return visited;
}
```

Santa's current position = `route[visitedCount]`

### 12. Real-Time UI Updates

```ts
// In React component
useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();
    const idx = getVisitedCountAt(now);
    setCurrentCity(route[idx]);
  }, 1000); // Update every second
  
  return () => clearInterval(interval);
}, []);
```

---

## Phase 6 — Front-End Visualization (Radar Map)

### 13. Mapbox / Deck.gl Display

- **Base layer**: Custom radar-green theme
- **Santa's path**: Great-circle arcs
- **Past edges**: Faint trail
- **Recent edges**: Bright, animated
- **Active city**: Glowing pulsing dot
- **Santa position**: `route[visitedCount]`

---

## Phase 7 — Donation System (Optional)

> **Note**: Supabase is only needed if you add donations or user features. The flight itself requires no database.

### Option A: Partner with Known Charity
- Easy integration
- No compliance burden
- Use their URL with referral codes
- Track totals via their API or custom campaign link

### Option B: Fiscal Sponsor + Stripe Checkout
- Accept tax-deductible donations directly
- Stripe Checkout + Webhooks → Supabase
- Real-time donation counter on site

---

## Phase 8 — Hosting + Scheduling

- **Next.js** app on **Vercel**
- Pre-generate city data + route at build time
- Real-time uses `Date.now()` for current UTC
- Users can join at any point in the timeline
- After mission complete → show full path replay

### User Experience by Time

| User visits at... | They see... |
|-------------------|-------------|
| Before Dec 24 10:00 UTC | Countdown to launch |
| Dec 24, 14:00 UTC | Santa live over Japan |
| Dec 25, 00:00 UTC | Santa live over Europe |
| Dec 25, 10:00 UTC | Santa live over Americas |
| After Dec 26, 13:00 UTC | Mission complete — replay mode |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Components | Headless UI |
| Maps | Mapbox GL / Deck.gl |
| Time | Luxon |
| Timezone Lookup | tz-lookup |
| Hosting | Vercel |
| Database | Supabase *(only if donations added)* |

---

## Data Architecture

```
public/
  worldcities.csv       # ✅ Raw SimpleMaps data (48k cities)

src/
  data/
    route.json          # Pre-computed ordered city list (generated)
    zones.json          # Timezone windows + timing (generated)
  
  lib/
    mission-engine.ts   # getVisitedCountAt() + helpers
    process-cities.ts   # Build script: CSV → JSON

scripts/
  generate-route.ts     # One-time build script
```

### Build-Time vs Runtime

| Data | When Generated | How Used |
|------|----------------|----------|
| `route.json` | Build time | Imported statically |
| `zones.json` | Build time | Imported statically |
| Santa's position | Runtime | Calculated from `Date.now()` |

---

## Action Checklist

- [x] Download SimpleMaps dataset → `/public/worldcities.csv`
- [ ] Install dependencies (`tz-lookup`, `luxon`)
- [ ] Create build script to process CSV
- [ ] Normalize + enrich with timezone + UTC offset
- [ ] Group cities by offset
- [ ] Sort by latitude within each zone
- [ ] Apply snake pattern (alternating direction)
- [ ] Flatten into final route array
- [ ] Compute midnight windows per timezone
- [ ] Compute time-per-city per timezone
- [ ] Output `route.json` and `zones.json`
- [ ] Implement mission engine (`getVisitedCountAt`)
- [ ] Build real-time UI with `setInterval`
- [ ] Integrate with Mapbox
- [ ] Add donation system *(optional)*
- [ ] Deploy to Vercel

---

## Getting Started

```bash
# Install dependencies
npm install

# Generate route data (run once, or at build)
npm run generate-route

# Run development server
npm run dev
```

---

*Built with ❤️ for Christmas*
