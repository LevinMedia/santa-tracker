/**
 * Enriches worldcities.csv with timezone and UTC offset for Dec 25, 2025
 * 
 * Usage: npx tsx scripts/enrich-cities.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import tzlookup from 'tz-lookup';
import { DateTime } from 'luxon';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/worldcities.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/worldcities-enriched.csv');

interface CityRow {
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
}

interface EnrichedCity extends CityRow {
  timezone: string;
  utc_offset: string;
}

console.log('📖 Reading worldcities.csv...');
const csvContent = readFileSync(INPUT_FILE, 'utf-8');

console.log('🔄 Parsing CSV...');
const cities: CityRow[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`📍 Processing ${cities.length} cities...`);

let processed = 0;
let errors = 0;

const enrichedCities: EnrichedCity[] = cities.map((city) => {
  const lat = parseFloat(city.lat);
  const lng = parseFloat(city.lng);
  
  let timezone = '';
  let utc_offset = '';
  
  try {
    // Get IANA timezone from coordinates
    timezone = tzlookup(lat, lng);
    
    // Calculate UTC offset for Dec 25, 2025 (accounts for DST)
    const dt = DateTime.fromISO('2025-12-25T00:00:00', { zone: timezone });
    utc_offset = (dt.offset / 60).toString(); // Convert minutes to hours
  } catch (err) {
    errors++;
    // Some edge coordinates (ocean, poles) may fail - use UTC as fallback
    timezone = 'UTC';
    utc_offset = '0';
  }
  
  processed++;
  if (processed % 5000 === 0) {
    console.log(`   Processed ${processed}/${cities.length} cities...`);
  }
  
  return {
    ...city,
    timezone,
    utc_offset,
  };
});

console.log('💾 Writing enriched CSV...');
const output = stringify(enrichedCities, {
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
console.log(`   📊 Cities processed: ${processed}`);
console.log(`   ⚠️  Fallback to UTC: ${errors}`);




