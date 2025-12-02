/**
 * Enriches Santa tracker CSV with weather data from Open-Meteo Archive API
 *
 * For each Santa stop, fetches weather data for the exact UTC hour:
 * - temperature_c (temperature_2m)
 * - weather_condition (decoded from weathercode)
 * - wind_speed_mps (wind_speed_10m, converted from km/h)
 * - wind_direction_deg (winddirection_10m)
 * - wind_gust_mps (windgusts_10m, converted from km/h)
 *
 * Usage: npx tsx scripts/add-weather-data.ts
 *
 * Environment variables:
 *   OPEN_METEO_API_KEY - Optional API key for paid tier (unlimited daily requests)
 *
 * Note: Open-Meteo Archive API only works for historical dates.
 * If the CSV dates are in the future, the script will use the previous year's data.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { config } from "dotenv";
import path from "path";

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), ".env.local") });

// Note: Archive API requires Professional/Enterprise plan
// Standard plan only works for Forecast API
// Set this to your Professional plan API key, or leave undefined to use free tier
const OPEN_METEO_API_KEY = process.env.OPEN_METEO_ARCHIVE_API_KEY;

const INPUT_FILE = path.join(process.cwd(), "public/2024_santa_tracker.csv");
const OUTPUT_FILE = path.join(
  process.cwd(),
  "public/2024_santa_tracker_weather.csv"
);
const PROGRESS_FILE = path.join(
  process.cwd(),
  "public/.weather_progress.json"
);

// Save progress every N groups
const SAVE_PROGRESS_INTERVAL = 100;

// Open-Meteo rate limits:
// Free tier: 600/min, 5,000/hr, 10,000/day
// Paid tier: Unlimited per day (just monthly quota)
const IS_PAID_TIER = !!OPEN_METEO_API_KEY;
const DAILY_QUOTA = IS_PAID_TIER ? Infinity : 10000;
const DELAY_BETWEEN_REQUESTS_MS = IS_PAID_TIER ? 50 : 120; // Faster for paid tier
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
const RATE_LIMIT_DELAY_MS = 60000;

interface SantaStop {
  stop_number: string;
  city: string;
  country: string;
  lat: string;
  lng: string;
  timezone: string;
  utc_offset: string;
  utc_offset_rounded: string;
  utc_time: string;
  local_time: string;
  population: string;
}

interface WeatherData {
  temperature_c: string;
  weather_condition: string;
  wind_speed_mps: string;
  wind_direction_deg: string;
  wind_gust_mps: string;
}

interface EnrichedStop extends SantaStop, WeatherData {}

// WMO Weather interpretation codes (https://open-meteo.com/en/docs)
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function decodeWeatherCode(code: number | null): string {
  if (code === null || code === undefined) return "";
  return WEATHER_CODES[code] || `Unknown (${code})`;
}

// Convert km/h to m/s
function kmhToMps(kmh: number | null): string {
  if (kmh === null || kmh === undefined) return "";
  return (kmh / 3.6).toFixed(2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProgressData {
  processedKeys: string[];
  weatherCache: Record<string, WeatherData>;
  lastUpdated: string;
}

function loadProgress(): ProgressData | null {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const data = readFileSync(PROGRESS_FILE, "utf-8");
      return JSON.parse(data) as ProgressData;
    }
  } catch (error) {
    console.log("   ⚠️  Could not load progress file, starting fresh");
  }
  return null;
}

function saveProgress(
  processedKeys: Set<string>,
  weatherCache: Map<string, WeatherData>
) {
  const data: ProgressData = {
    processedKeys: Array.from(processedKeys),
    weatherCache: Object.fromEntries(weatherCache),
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(PROGRESS_FILE, JSON.stringify(data));
}

async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      if (response.status === 429) {
        // Rate limited - use exponential backoff
        const waitTime = RATE_LIMIT_DELAY_MS * attempt;
        if (attempt < retries) {
          await sleep(waitTime);
          continue;
        }
      }
      if (attempt === retries) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error("Max retries exceeded");
}

interface HourlyData {
  time: string[];
  temperature_2m: (number | null)[];
  weathercode: (number | null)[];
  wind_speed_10m: (number | null)[];
  winddirection_10m: (number | null)[];
  windgusts_10m: (number | null)[];
}

interface OpenMeteoResponse {
  hourly?: HourlyData;
  error?: boolean;
  reason?: string;
}

async function fetchWeatherForLocation(
  lat: number,
  lng: number,
  date: string
): Promise<OpenMeteoResponse | null> {
  // Paid tier uses customer endpoint, free tier uses regular endpoint
  const baseUrl = OPEN_METEO_API_KEY
    ? "https://customer-archive-api.open-meteo.com/v1/archive"
    : "https://archive-api.open-meteo.com/v1/archive";
  
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set(
    "hourly",
    "temperature_2m,weathercode,wind_speed_10m,winddirection_10m,windgusts_10m"
  );
  url.searchParams.set("timezone", "UTC");
  
  // Add API key for paid tier
  if (OPEN_METEO_API_KEY) {
    url.searchParams.set("apikey", OPEN_METEO_API_KEY);
  }

  try {
    const response = await fetchWithRetry(url.toString());
    const data = (await response.json()) as OpenMeteoResponse;
    return data;
  } catch (error) {
    console.error(`   ❌ Failed to fetch weather for ${lat}, ${lng}: ${error}`);
    return null;
  }
}

function getWeatherForHour(
  data: OpenMeteoResponse | null,
  targetHour: number
): WeatherData {
  const empty: WeatherData = {
    temperature_c: "",
    weather_condition: "",
    wind_speed_mps: "",
    wind_direction_deg: "",
    wind_gust_mps: "",
  };

  if (!data || !data.hourly || data.error) {
    return empty;
  }

  const hourly = data.hourly;
  const hourIndex = targetHour; // hourly array is 0-23 indexed

  if (hourIndex < 0 || hourIndex >= hourly.time.length) {
    return empty;
  }

  return {
    temperature_c:
      hourly.temperature_2m[hourIndex] !== null
        ? hourly.temperature_2m[hourIndex]!.toFixed(1)
        : "",
    weather_condition: decodeWeatherCode(hourly.weathercode[hourIndex]),
    wind_speed_mps: kmhToMps(hourly.wind_speed_10m[hourIndex]),
    wind_direction_deg:
      hourly.winddirection_10m[hourIndex] !== null
        ? hourly.winddirection_10m[hourIndex]!.toString()
        : "",
    wind_gust_mps: kmhToMps(hourly.windgusts_10m[hourIndex]),
  };
}

// Group stops by date and approximate location to reduce API calls
interface LocationGroup {
  date: string;
  lat: number;
  lng: number;
  stops: { index: number; hour: number }[];
}

function groupStopsByLocation(
  stops: SantaStop[]
): Map<string, LocationGroup> {
  const groups = new Map<string, LocationGroup>();

  stops.forEach((stop, index) => {
    const utcTime = new Date(stop.utc_time.replace(" ", "T") + "Z");
    const date = stop.utc_time.split(" ")[0]; // YYYY-MM-DD
    const hour = utcTime.getUTCHours();
    const lat = parseFloat(stop.lat);
    const lng = parseFloat(stop.lng);

    // Round lat/lng to 0.5 degree grid to group nearby locations
    const gridLat = Math.round(lat * 2) / 2;
    const gridLng = Math.round(lng * 2) / 2;

    const key = `${date}:${gridLat}:${gridLng}`;

    if (!groups.has(key)) {
      groups.set(key, {
        date,
        lat: gridLat,
        lng: gridLng,
        stops: [],
      });
    }

    groups.get(key)!.stops.push({ index, hour });
  });

  return groups;
}

async function main() {
  console.log("🎅 Santa Tracker Weather Enrichment Script");
  console.log("==========================================\n");

  if (IS_PAID_TIER) {
    console.log("🔑 Using paid API tier (unlimited daily requests)\n");
  } else {
    console.log("🆓 Using free API tier (10,000 requests/day limit)");
    console.log("   Set OPEN_METEO_API_KEY in .env.local for unlimited access\n");
  }

  console.log("📖 Reading Santa tracker CSV...");
  const csvContent = readFileSync(INPUT_FILE, "utf-8");

  console.log("🔄 Parsing CSV...");
  const stops: SantaStop[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📍 Found ${stops.length} Santa stops\n`);

  // Check if dates are in the future
  const firstDate = stops[0].utc_time.split(" ")[0];
  const dateObj = new Date(firstDate);
  const now = new Date();

  let useHistoricalYear = false;
  let yearOffset = 0;

  if (dateObj > now) {
    console.log(
      "⚠️  Dates in CSV are in the future. Using previous year data as proxy."
    );
    yearOffset = -1;
    useHistoricalYear = true;
  }

  // Group stops to reduce API calls
  console.log("📊 Grouping stops by location grid...");
  const groups = groupStopsByLocation(stops);
  console.log(`   Created ${groups.size} location groups`);
  
  if (groups.size > DAILY_QUOTA) {
    console.log(`\n⚠️  WARNING: ${groups.size} groups exceeds daily quota of ${DAILY_QUOTA}`);
    console.log(`   This will require multiple runs across ${Math.ceil(groups.size / DAILY_QUOTA)} days.`);
    console.log(`   Progress is saved automatically - you can resume anytime.\n`);
  } else {
    console.log();
  }

  // Initialize weather data array
  const weatherData: WeatherData[] = stops.map(() => ({
    temperature_c: "",
    weather_condition: "",
    wind_speed_mps: "",
    wind_direction_deg: "",
    wind_gust_mps: "",
  }));

  // Check for existing progress
  const existingProgress = loadProgress();
  const processedKeys = new Set<string>(existingProgress?.processedKeys || []);
  const weatherCache = new Map<string, WeatherData>(
    Object.entries(existingProgress?.weatherCache || {})
  );

  if (existingProgress) {
    console.log(
      `📂 Resuming from previous run (${processedKeys.size} groups already processed)\n`
    );
    // Apply cached weather data
    for (const [key, group] of groups.entries()) {
      if (weatherCache.has(key)) {
        for (const stop of group.stops) {
          weatherData[stop.index] = weatherCache.get(key)!;
        }
      }
    }
  }

  // Process groups
  const groupArray = Array.from(groups.entries());
  let processed = processedKeys.size;
  let apiCalls = 0;
  let errors = 0;
  let skipped = 0;

  console.log("🌤️  Fetching weather data from Open-Meteo Archive API...\n");

  for (let i = 0; i < groupArray.length; i++) {
    const [key, group] = groupArray[i];

    // Skip already processed
    if (processedKeys.has(key)) {
      skipped++;
      continue;
    }

    let dateToFetch = group.date;

    // Adjust year if needed
    if (useHistoricalYear) {
      const [year, month, day] = dateToFetch.split("-");
      dateToFetch = `${parseInt(year) + yearOffset}-${month}-${day}`;
    }

    const data = await fetchWeatherForLocation(
      group.lat,
      group.lng,
      dateToFetch
    );
    apiCalls++;

    if (!data || data.error) {
      errors++;
    } else {
      // Get weather for the first stop's hour (all stops in group share similar time)
      const weather = getWeatherForHour(data, group.stops[0].hour);
      weatherCache.set(key, weather);

      // Apply weather data to all stops in this group
      for (const stop of group.stops) {
        weatherData[stop.index] = weather;
      }
    }

    processedKeys.add(key);
    processed++;

    // Save progress periodically
    if (processed % SAVE_PROGRESS_INTERVAL === 0) {
      saveProgress(processedKeys, weatherCache);
    }

    const percentage = ((processed / groupArray.length) * 100).toFixed(1);
    process.stdout.write(
      `\r   Progress: ${processed}/${groupArray.length} groups (${percentage}%) | API: ${apiCalls} | Errors: ${errors}   `
    );

    // Check if approaching daily quota (leave buffer of 100)
    if (apiCalls >= DAILY_QUOTA - 100) {
      console.log(`\n\n⏸️  Approaching daily quota (${apiCalls} API calls).`);
      console.log(`   Progress saved. Run again tomorrow to continue.`);
      saveProgress(processedKeys, weatherCache);
      break;
    }

    // Rate limit between requests
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }
  console.log(); // New line after progress

  // Final save
  saveProgress(processedKeys, weatherCache);

  console.log("\n📝 Creating enriched CSV...");

  // Merge weather data with stops
  const enrichedStops: EnrichedStop[] = stops.map((stop, index) => ({
    ...stop,
    ...weatherData[index],
  }));

  // Count stops with weather data
  const withWeather = enrichedStops.filter((s) => s.temperature_c !== "").length;

  console.log("💾 Writing enriched CSV...");
  const output = stringify(enrichedStops, {
    header: true,
    columns: [
      "stop_number",
      "city",
      "country",
      "lat",
      "lng",
      "timezone",
      "utc_offset",
      "utc_offset_rounded",
      "utc_time",
      "local_time",
      "population",
      "temperature_c",
      "weather_condition",
      "wind_speed_mps",
      "wind_direction_deg",
      "wind_gust_mps",
    ],
  });

  writeFileSync(OUTPUT_FILE, output);

  // Clean up progress file after successful completion
  if (existsSync(PROGRESS_FILE)) {
    unlinkSync(PROGRESS_FILE);
    console.log("   🧹 Cleaned up progress file");
  }

  console.log("\n✅ Done!");
  console.log(`   📄 Output: ${OUTPUT_FILE}`);
  console.log(`   📊 Total stops: ${stops.length}`);
  console.log(`   🌤️  Stops with weather data: ${withWeather}`);
  console.log(`   🌐 API calls made: ${apiCalls}`);
  console.log(`   ⚠️  Errors: ${errors}`);
  if (useHistoricalYear) {
    console.log(
      `   📅 Used ${firstDate.split("-")[0]} + ${yearOffset} year data as historical proxy`
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

