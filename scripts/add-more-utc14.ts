/**
 * Adds additional UTC+14 villages on Kiritimati (Christmas Island)
 * 
 * Usage: npx tsx scripts/add-more-utc14.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv');

interface City {
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

// Additional UTC+14 villages on Kiritimati (Christmas Island)
// These are distinct settlements on the world's largest coral atoll
const additionalCities: City[] = [
  {
    city: "London",
    city_ascii: "London",
    lat: "1.9833",
    lng: "-157.4750",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "1879",
    id: "9000000004",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
  {
    city: "Tabwakea",
    city_ascii: "Tabwakea",
    lat: "1.9917",
    lng: "-157.4583",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "2232",
    id: "9000000005",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
  {
    city: "Banana",
    city_ascii: "Banana",
    lat: "1.9833",
    lng: "-157.3500",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "1063",
    id: "9000000006",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
  {
    city: "Poland",
    city_ascii: "Poland",
    lat: "2.0000",
    lng: "-157.4167",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "521",
    id: "9000000007",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
];

console.log('📖 Reading worldcities-sorted.csv...');
const csvContent = readFileSync(INPUT_FILE, 'utf-8');

console.log('🔄 Parsing CSV...');
const cities: City[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`📍 Current cities: ${cities.length}`);

// Check what UTC+14 cities we already have
const existing14 = cities.filter(c => c.utc_offset === '14');
console.log(`\n📊 Existing UTC+14 cities: ${existing14.length}`);
existing14.forEach(c => console.log(`   - ${c.city}`));

console.log(`\n➕ Adding ${additionalCities.length} more UTC+14 villages...`);
additionalCities.forEach(c => console.log(`   + ${c.city} (pop: ${c.population})`));

// Add new cities
const allCities = [...additionalCities, ...cities];

// Re-sort
allCities.sort((a, b) => {
  const offsetA = parseFloat(a.utc_offset);
  const offsetB = parseFloat(b.utc_offset);
  if (offsetB !== offsetA) return offsetB - offsetA;
  // Secondary sort by latitude (north to south) within same timezone
  return parseFloat(b.lat) - parseFloat(a.lat);
});

console.log(`\n📊 Total cities now: ${allCities.length}`);

// Show all UTC+14 cities
const all14 = allCities.filter(c => c.utc_offset === '14');
console.log(`\n🌅 All UTC+14 cities (${all14.length}):`);
all14.forEach((c, i) => console.log(`   ${i + 1}. ${c.city} (${c.population} people)`));

console.log('\n💾 Writing updated CSV...');
const output = stringify(allCities, {
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

console.log('\n✅ Done!');

