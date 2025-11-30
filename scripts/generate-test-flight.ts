/**
 * Generates Test-Flight-1: Santa's complete route with timing
 * 
 * - Starts at North Pole (included in UTC+14 timezone group)
 * - Ends at North Pole (included in UTC-11 timezone group)
 * - Groups cities by rounded timezone (5.5 → 5, 13.75 → 13)
 * - Snake pattern: alternating north→south, south→north
 * - 1 hour per timezone, evenly distributed across cities
 * - Adds UTC time and local time columns
 * 
 * Usage: npx tsx scripts/generate-test-flight.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { DateTime } from 'luxon';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/test-flight-1.csv');

// Mission starts Dec 25, 2025 at midnight in UTC+14 timezone
// That's Dec 24, 2025 at 10:00 UTC
const MISSION_START_UTC = DateTime.fromISO('2025-12-24T10:00:00', { zone: 'UTC' });

interface CityInput {
  city: string;
  city_ascii: string;
  lat: string;
  lng: string;
  country: string;
  iso2: string;
  iso3: string;
  admin_name: string;
  capital: string;
  population: string;
  id: string;
  timezone: string;
  utc_offset: string;
}

interface FlightStop {
  stop_number: number;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  utc_offset: number;
  utc_offset_rounded: number;
  utc_time: string;
  local_time: string;
  population: number;
}

// Round timezone toward zero (truncate decimal)
function roundTimezone(offset: number): number {
  return Math.trunc(offset);
}

console.log('📖 Reading worldcities-sorted.csv...');
const csvContent = readFileSync(INPUT_FILE, 'utf-8');

console.log('🔄 Parsing CSV...');
const cities: CityInput[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`📍 Total cities: ${cities.length}`);

// Group cities by rounded timezone
console.log('\n📊 Grouping cities by rounded timezone...');
const timezoneGroups = new Map<number, CityInput[]>();

cities.forEach(city => {
  const offset = parseFloat(city.utc_offset);
  const rounded = roundTimezone(offset);
  
  if (!timezoneGroups.has(rounded)) {
    timezoneGroups.set(rounded, []);
  }
  timezoneGroups.get(rounded)!.push(city);
});

// Sort timezone groups by offset (descending: east to west, +14 → -12)
const sortedOffsets = Array.from(timezoneGroups.keys()).sort((a, b) => b - a);

console.log(`   Found ${sortedOffsets.length} timezone groups`);
console.log(`   Range: UTC+${sortedOffsets[0]} to UTC${sortedOffsets[sortedOffsets.length - 1]}`);

// Create North Pole entries as CityInput format
const northPoleCity: CityInput = {
  city: 'North Pole',
  city_ascii: 'North Pole',
  lat: '90',
  lng: '0',
  country: 'Arctic',
  iso2: 'NP',
  iso3: 'NOP',
  admin_name: '',
  capital: '',
  population: '0',
  id: '0',
  timezone: 'UTC',
  utc_offset: '14', // Will be treated as UTC+14 for start
};

// Add North Pole to the START of UTC+14 group (first timezone)
const firstTimezone = sortedOffsets[0]; // Should be 14
if (timezoneGroups.has(firstTimezone)) {
  // North Pole goes at the very beginning (before sorting)
  // We'll handle this specially in the loop
}

// Add North Pole to the END of UTC-11 group (last timezone)  
const lastTimezone = sortedOffsets[sortedOffsets.length - 1]; // Should be -11

// Apply snake pattern and build route
console.log('\n🐍 Applying snake pattern (alternating N→S, S→N)...');
const route: FlightStop[] = [];

let currentUTC = MISSION_START_UTC;

sortedOffsets.forEach((offset, zoneIndex) => {
  const zoneCities = [...timezoneGroups.get(offset)!]; // Clone to avoid mutation
  
  // Sort by latitude
  zoneCities.sort((a, b) => parseFloat(b.lat) - parseFloat(a.lat)); // North to South
  
  // Reverse for odd indices (snake pattern)
  if (zoneIndex % 2 === 1) {
    zoneCities.reverse(); // South to North
  }
  
  // Add North Pole at START of first timezone (UTC+14)
  // Since we're going N→S, North Pole (90°N) goes first
  if (offset === firstTimezone) {
    zoneCities.unshift({
      ...northPoleCity,
      utc_offset: offset.toString(),
    });
  }
  
  // Add North Pole at END of last timezone (UTC-11)
  if (offset === lastTimezone) {
    zoneCities.push({
      ...northPoleCity,
      utc_offset: offset.toString(),
    });
  }
  
  // Calculate time per city in this zone (1 hour = 3600000ms)
  const msPerCity = 3600000 / zoneCities.length;
  
  // Add each city to route
  zoneCities.forEach((city, cityIndex) => {
    const cityOffset = parseFloat(city.utc_offset);
    const utcTime = currentUTC.plus({ milliseconds: cityIndex * msPerCity });
    
    // For North Pole, use UTC as timezone
    const tz = city.city === 'North Pole' ? 'UTC' : city.timezone;
    const localTime = city.city === 'North Pole' 
      ? utcTime.plus({ hours: offset }) // Pretend it's in this timezone
      : utcTime.setZone(city.timezone);
    
    route.push({
      stop_number: route.length + 1,
      city: city.city,
      country: city.country,
      lat: parseFloat(city.lat),
      lng: parseFloat(city.lng),
      timezone: city.city === 'North Pole' ? `UTC${offset >= 0 ? '+' : ''}${offset}` : city.timezone,
      utc_offset: offset, // Use the group offset
      utc_offset_rounded: offset,
      utc_time: utcTime.toFormat('yyyy-MM-dd HH:mm:ss'),
      local_time: localTime.toFormat('yyyy-MM-dd HH:mm:ss'),
      population: parseInt(city.population) || 0,
    });
  });
  
  // Move to next hour for next timezone
  currentUTC = currentUTC.plus({ hours: 1 });
});

console.log(`\n✈️  Total stops: ${route.length}`);
console.log(`   First stop: ${route[0].city} at ${route[0].utc_time} UTC`);
console.log(`   Second stop: ${route[1].city} at ${route[1].utc_time} UTC`);
console.log(`   Second-to-last: ${route[route.length - 2].city} at ${route[route.length - 2].utc_time} UTC`);
console.log(`   Last stop: ${route[route.length - 1].city} at ${route[route.length - 1].utc_time} UTC`);

// Calculate mission duration
const startTime = DateTime.fromFormat(route[0].utc_time, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' });
const endTime = DateTime.fromFormat(route[route.length - 1].utc_time, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' });
const durationHours = endTime.diff(startTime, 'hours').hours;
console.log(`   Mission duration: ${durationHours.toFixed(1)} hours`);

// Show timezone summary
console.log('\n📊 Timezone breakdown (with North Pole included):');
sortedOffsets.slice(0, 3).forEach(offset => {
  let count = timezoneGroups.get(offset)!.length;
  if (offset === firstTimezone) count += 1; // North Pole start
  if (offset === lastTimezone) count += 1; // North Pole end
  const msPerCity = 3600000 / count;
  console.log(`   UTC${offset >= 0 ? '+' : ''}${offset}: ${count} stops (${(msPerCity / 1000).toFixed(2)}s each)`);
});
console.log('   ...');
sortedOffsets.slice(-3).forEach(offset => {
  let count = timezoneGroups.get(offset)!.length;
  if (offset === firstTimezone) count += 1;
  if (offset === lastTimezone) count += 1;
  const msPerCity = 3600000 / count;
  console.log(`   UTC${offset >= 0 ? '+' : ''}${offset}: ${count} stops (${(msPerCity / 1000).toFixed(2)}s each)`);
});

console.log('\n💾 Writing test-flight-1.csv...');
const output = stringify(route, {
  header: true,
  columns: [
    'stop_number',
    'city',
    'country',
    'lat',
    'lng',
    'timezone',
    'utc_offset',
    'utc_offset_rounded',
    'utc_time',
    'local_time',
    'population',
  ],
});

writeFileSync(OUTPUT_FILE, output);

console.log('\n✅ Done!');
console.log(`   📄 Output: ${OUTPUT_FILE}`);
console.log(`   🎅 North Pole → ${route.length - 2} cities → North Pole`);
