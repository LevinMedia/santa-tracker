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

The **route is static** (pre-computed CSV). The **position is dynamic** (calculated from clock).

---

## Current Status: v0.1 ✅

### What's Built

| Feature | Status | Notes |
|---------|--------|-------|
| City Dataset | ✅ Complete | 48,066 cities with timezone data |
| Route Generation | ✅ Complete | Snake pattern, UTC+14 to UTC-11 |
| Radar Map UI | ✅ Complete | Leaflet + CARTO dark tiles |
| Real-time Playback | ✅ Complete | Timestamp-based with speed controls |
| C64 Terminal Aesthetic | ✅ Complete | Green phosphor glow, retro UI |
| Keyboard Navigation | ✅ Complete | Type "1" + Enter, ESC to go back |

---

## Phase 1 — Build the City Dataset ✅

### 1. Download the SimpleMaps Dataset ✅

**Done!** → `public/worldcities.csv` (48,060 cities)

### 2. Enrich with Timezone Data ✅

**Done!** → `public/worldcities-enriched.csv`

Script: `scripts/enrich-cities.ts`

```ts
import tzlookup from 'tz-lookup';
import { DateTime } from 'luxon';

city.timezone = tzlookup(city.lat, city.lng);
const dt = DateTime.fromISO("2025-12-25T00:00:00", { zone: city.timezone });
city.utc_offset = dt.offset / 60; // hours
```

### 3. Sort by Timezone ✅

**Done!** → `public/worldcities-sorted.csv`

Script: `scripts/sort-by-timezone.ts`

Cities sorted by:
1. UTC offset (descending: +14 → -12)
2. Latitude (descending: north → south)

### 4. Add Missing UTC+14 Cities ✅

**Done!** → Added Line Islands (Kiribati):
- Kiritimati, Tabuaeran, Teraina
- Villages: London, Tabwakea, Banana, Poland

Scripts: `scripts/add-utc14-cities.ts`, `scripts/add-more-utc14.ts`

---

## Phase 2 — Generate Flight Route ✅

### Test Flight Generated ✅

**Done!** → `public/test-flight-1.csv` (48,068 stops)

Script: `scripts/generate-test-flight.ts`

Features:
- North Pole as first stop (UTC+14 start)
- North Pole as last stop (UTC-11 end)
- Snake pattern within each timezone group
- Rounded timezone grouping (5.5 → 5, 13.75 → 14)
- UTC and local time for each stop
- ~26 hour mission duration

CSV Format:
```
stop_number,city,country,lat,lng,timezone,utc_offset,rounded_offset,utc_time,local_time
1,North Pole,Arctic,90,0,UTC,14,14,2025-12-24 10:00:00,2025-12-25 00:00:00
2,Teraina,Kiribati,4.6833,-160.3833,Pacific/Kiritimati,14,14,2025-12-24 10:00:05,...
```

---

## Phase 3 — Radar Map Visualization ✅

### Map Implementation ✅

**Done!** → `src/app/map/page.tsx` + `src/components/RadarMap.tsx`

Tech Stack:
- **Leaflet.js** via `react-leaflet` (no API key needed)
- **CARTO Dark Matter** tiles
- CSS filters for green radar aesthetic

Features:
- Additive city rendering (dots appear as visited)
- Current stop highlight (larger glowing dot)
- Auto-pan to follow Santa's longitude
- Horizontal scan beam animation
- CRT screen effects (scan lines, vignette, flicker)

### Playback Controls ✅

- Play/Pause with real-time timestamp tracking
- Timeline scrubber
- Speed options: 1x (real), 2x, 10x, 60x, MAX (300x)
- Live UTC clock during playback
- ETA display

---

## Phase 4 — Terminal UI ✅

### Home Page (C64 Style) ✅

**Done!** → `src/app/page.tsx`

Boot sequence:
1. North Pole Computing C64 header
2. LOAD "SANTA_TRACKER",8,1
3. ASCII art title
4. Multi-language "hacking" messages (English, Chinese, Russian)
5. System status display
6. Command menu

Keyboard support:
- Type "1" + Enter → Navigate to map
- Full typewriter effect on commands

### Map Page Header ✅

**Done!** → Matching terminal aesthetic
- [ESC] BACK button (keyboard supported)
- System online indicator
- Version tag (v0.1)
- Terminal corner decorations

---

## Phase 5 — Remaining Work

### TODO: Live Mode

- [ ] Implement `getVisitedCountAt(Date.now())` for real Christmas Eve
- [ ] Countdown page before Dec 24 10:00 UTC
- [ ] "Mission Complete" state after Dec 26 13:00 UTC
- [ ] Toggle between live mode and replay mode

### TODO: Polish

- [ ] Mobile responsive design
- [ ] Touch-friendly scrubber
- [ ] Loading states and error handling
- [ ] Performance optimization for 48k markers

### TODO: Optional Features

- [ ] Donation system integration
- [ ] Social sharing
- [ ] City search/jump
- [ ] Statistics dashboard

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Components | Headless UI |
| Maps | Leaflet + react-leaflet |
| Tiles | CARTO Dark Matter |
| Time | Luxon |
| Timezone Lookup | tz-lookup |
| CSV Processing | csv-parse, csv-stringify |
| Hosting | Vercel |
| Database | Supabase *(only if donations added)* |

---

## Project Structure

```
public/
  worldcities.csv           # Raw SimpleMaps data
  worldcities-enriched.csv  # + timezone, utc_offset columns
  worldcities-sorted.csv    # Sorted by timezone (east → west)
  test-flight-1.csv         # Generated flight with timestamps

scripts/
  enrich-cities.ts          # Add timezone data to cities
  sort-by-timezone.ts       # Sort cities by offset
  add-utc14-cities.ts       # Add Line Islands
  add-more-utc14.ts         # Add more Kiritimati villages
  generate-test-flight.ts   # Create timestamped flight route

src/
  app/
    page.tsx                # Home page (C64 terminal)
    map/page.tsx            # Radar map page
    globals.css             # Animations, theme variables
    layout.tsx              # Fonts (Crimson Pro, JetBrains Mono)
  
  components/
    RadarMap.tsx            # Leaflet map + playback controls
  
  lib/
    supabase/               # Supabase client (for future donations)
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Generate flight data (if modifying route)
npx tsx scripts/generate-test-flight.ts
```

---

## Deployment

Hosted on Vercel: https://santa-tracker.vercel.app *(when deployed)*

GitHub: https://github.com/LevinMedia/santa-tracker

---

*Built with ❤️ for Christmas*
