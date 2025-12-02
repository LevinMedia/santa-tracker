/**
 * Adds missing UTC+14 cities (Line Islands, Kiribati) to the sorted CSV
 * 
 * Usage: npx tsx scripts/add-utc14-cities.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/worldcities-sorted.csv'); // Overwrite

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

// UTC+14 cities - Line Islands, Kiribati
// These are the first places on Earth to celebrate New Year/Christmas
const utc14Cities: City[] = [
  {
    city: "Kiritimati",
    city_ascii: "Kiritimati",
    lat: "1.8721",
    lng: "-157.3630", // Note: longitude is negative but timezone is +14
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "admin",
    population: "6447",
    id: "9000000001",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
  {
    city: "Tabuaeran",
    city_ascii: "Tabuaeran", 
    lat: "3.8631",
    lng: "-159.3236",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "2539",
    id: "9000000002",
    timezone: "Pacific/Kiritimati",
    utc_offset: "14",
  },
  {
    city: "Teraina",
    city_ascii: "Teraina",
    lat: "4.6833",
    lng: "-160.3833",
    country: "Kiribati",
    iso2: "KI",
    iso3: "KIR",
    admin_name: "Line Islands",
    capital: "",
    population: "1712",
    id: "9000000003",
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

console.log(`📍 Original cities: ${cities.length}`);
console.log(`➕ Adding ${utc14Cities.length} UTC+14 cities...`);

// Add UTC+14 cities at the beginning
const allCities = [...utc14Cities, ...cities];

// Re-sort to ensure proper order
allCities.sort((a, b) => {
  const offsetA = parseFloat(a.utc_offset);
  const offsetB = parseFloat(b.utc_offset);
  return offsetB - offsetA;
});

console.log(`📊 Total cities now: ${allCities.length}`);

console.log('\n🌅 First 5 cities (should be UTC+14):');
allCities.slice(0, 5).forEach((city, i) => {
  console.log(`   ${i + 1}. ${city.city}, ${city.country} (UTC+${city.utc_offset})`);
});

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
console.log(`   📄 Output: ${OUTPUT_FILE}`);
console.log(`   🎄 Santa now starts at: ${allCities[0].city}, ${allCities[0].country}`);


