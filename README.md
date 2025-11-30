# 🎅 Santa Tracker

Real-time Santa tracking application built with Next.js, Tailwind CSS, Headless UI, and Mapbox.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — Santa status dashboard |
| `/map` | Radar Map — Retro green radar-style world map |

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Mapbox (optional - falls back to CARTO tiles)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token

# Supabase (optional - only needed for donations)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Tech Stack

- **Next.js 16** — React framework with App Router
- **Tailwind CSS** — Utility-first styling
- **Headless UI** — Accessible UI components
- **Mapbox GL** — Radar map visualization
- **Luxon** — Timezone handling
- **tz-lookup** — Coordinate to timezone conversion

## Project Structure

```
src/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   ├── map/
│   │   └── page.tsx    # Radar map page
│   └── globals.css     # Global styles
├── lib/
│   └── supabase/       # Supabase client utilities

public/
├── worldcities.csv           # Raw city data (48k cities)
├── worldcities-enriched.csv  # With timezone + offset
└── worldcities-sorted.csv    # Sorted by timezone (48,066 cities)

scripts/
├── enrich-cities.ts          # Add timezone data
├── sort-by-timezone.ts       # Sort east → west
└── add-utc14-cities.ts       # Add Line Islands
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx tsx scripts/enrich-cities.ts` | Process city data |

## Documentation

See [MASTER_PLAN.md](./MASTER_PLAN.md) for the full technical roadmap and implementation details.

## License

MIT
