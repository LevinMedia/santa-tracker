/**
 * Sorts enriched cities by timezone offset (east to west: +14 → -12)
 * 
 * Usage: npx tsx scripts/sort-by-timezone.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/worldcities-enriched.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv');

interface EnrichedCity {
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

console.log('📖 Reading worldcities-enriched.csv...');
const csvContent = readFileSync(INPUT_FILE, 'utf-8');

console.log('🔄 Parsing CSV...');
const cities: EnrichedCity[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`📍 Sorting ${cities.length} cities by timezone (east → west)...`);

// Sort by UTC offset descending (+14 first, -12 last)
const sortedCities = cities.sort((a, b) => {
  const offsetA = parseFloat(a.utc_offset);
  const offsetB = parseFloat(b.utc_offset);
  return offsetB - offsetA; // Descending: highest offset first
});

// Show distribution
const offsetCounts = new Map<number, number>();
sortedCities.forEach(city => {
  const offset = parseFloat(city.utc_offset);
  offsetCounts.set(offset, (offsetCounts.get(offset) || 0) + 1);
});

console.log('\n📊 Cities per timezone offset:');
const sortedOffsets = Array.from(offsetCounts.entries()).sort((a, b) => b[0] - a[0]);
sortedOffsets.forEach(([offset, count]) => {
  const sign = offset >= 0 ? '+' : '';
  console.log(`   UTC${sign}${offset}: ${count} cities`);
});

console.log('\n💾 Writing sorted CSV...');
const output = stringify(sortedCities, {
  header: true,
  columns: [
    'city',
    'city_ascii',
    'lat',
    'lng',
    'country',
    'iso2',
    'iso3',
    'admin_name',
    'capital',
    'population',
    'id',
    'timezone',
    'utc_offset',
  ],
});

writeFileSync(OUTPUT_FILE, output);

console.log('');
console.log('✅ Done!');
console.log(`   📄 Output: ${OUTPUT_FILE}`);
console.log(`   📊 Total cities: ${sortedCities.length}`);
console.log(`   🌅 First city: ${sortedCities[0].city} (UTC+${sortedCities[0].utc_offset})`);
console.log(`   🌃 Last city: ${sortedCities[sortedCities.length - 1].city} (UTC${sortedCities[sortedCities.length - 1].utc_offset})`);


