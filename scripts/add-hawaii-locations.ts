/**
 * Add more Hawaii locations to santa_seed.csv
 * Including Niihau (private island), Molokai, Lanai, and more towns on each island
 */

import * as fs from 'fs'
import * as path from 'path'

const csvPath = path.join(__dirname, '../public/santa_seed.csv')

// Hawaii locations by island
const hawaiiLocations = [
  // NIIHAU - The "Forbidden Island" (private, owned by Robinson family)
  { city: 'Niihau', country: 'United States', state_province: 'Hawaii', lat: 21.9000, lng: -160.1550, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 170 },
  
  // MOLOKAI
  { city: 'Kaunakakai', country: 'United States', state_province: 'Hawaii', lat: 21.0936, lng: -157.0236, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 3448 },
  { city: 'Kalaupapa', country: 'United States', state_province: 'Hawaii', lat: 21.1906, lng: -156.9797, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 82 },
  { city: 'Maunaloa', country: 'United States', state_province: 'Hawaii', lat: 21.1444, lng: -157.2211, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 259 },
  
  // LANAI
  { city: 'Lanai City', country: 'United States', state_province: 'Hawaii', lat: 20.8283, lng: -156.9217, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 3193 },
  { city: 'Manele Bay', country: 'United States', state_province: 'Hawaii', lat: 20.7422, lng: -156.8886, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 50 },
  
  // KAUAI (adding more)
  { city: 'Lihue', country: 'United States', state_province: 'Hawaii', lat: 21.9811, lng: -159.3711, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 7668 },
  { city: 'Princeville', country: 'United States', state_province: 'Hawaii', lat: 22.2175, lng: -159.4744, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2276 },
  { city: 'Poipu', country: 'United States', state_province: 'Hawaii', lat: 21.8783, lng: -159.4536, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 1300 },
  { city: 'Hanalei', country: 'United States', state_province: 'Hawaii', lat: 22.2047, lng: -159.5047, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 450 },
  { city: 'Koloa', country: 'United States', state_province: 'Hawaii', lat: 21.9069, lng: -159.4700, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2144 },
  { city: 'Waimea', country: 'United States', state_province: 'Hawaii', lat: 21.9564, lng: -159.6678, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 1700 },
  { city: 'Hanapepe', country: 'United States', state_province: 'Hawaii', lat: 21.9103, lng: -159.5919, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2700 },
  
  // BIG ISLAND (adding more)
  { city: 'Kailua-Kona', country: 'United States', state_province: 'Hawaii', lat: 19.6400, lng: -155.9969, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 14903 },
  { city: 'Captain Cook', country: 'United States', state_province: 'Hawaii', lat: 19.4958, lng: -155.9203, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 3429 },
  { city: 'Volcano', country: 'United States', state_province: 'Hawaii', lat: 19.4400, lng: -155.2336, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2575 },
  { city: 'Pahoa', country: 'United States', state_province: 'Hawaii', lat: 19.4944, lng: -154.9428, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 945 },
  { city: 'Kealakekua', country: 'United States', state_province: 'Hawaii', lat: 19.5208, lng: -155.9253, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2019 },
  { city: 'Honokaa', country: 'United States', state_province: 'Hawaii', lat: 20.0794, lng: -155.4672, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2233 },
  { city: 'Kohala', country: 'United States', state_province: 'Hawaii', lat: 20.2314, lng: -155.8019, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 6500 },
  { city: 'Waikoloa Village', country: 'United States', state_province: 'Hawaii', lat: 19.9286, lng: -155.7858, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 7800 },
  { city: 'Mauna Lani', country: 'United States', state_province: 'Hawaii', lat: 19.9300, lng: -155.8700, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 500 },
  { city: 'Ocean View', country: 'United States', state_province: 'Hawaii', lat: 19.3047, lng: -155.7661, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 4500 },
  { city: 'Naalehu', country: 'United States', state_province: 'Hawaii', lat: 19.0675, lng: -155.5833, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 866 },
  
  // MAUI (adding more)
  { city: 'Paia', country: 'United States', state_province: 'Hawaii', lat: 20.9031, lng: -156.3694, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 2668 },
  { city: 'Makawao', country: 'United States', state_province: 'Hawaii', lat: 20.8567, lng: -156.3128, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 7184 },
  { city: 'Hana', country: 'United States', state_province: 'Hawaii', lat: 20.7575, lng: -155.9903, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 1235 },
  { city: 'Kaanapali', country: 'United States', state_province: 'Hawaii', lat: 20.9256, lng: -156.6942, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 1200 },
  { city: 'Napili', country: 'United States', state_province: 'Hawaii', lat: 20.9961, lng: -156.6656, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 3000 },
  { city: 'Wailea', country: 'United States', state_province: 'Hawaii', lat: 20.6869, lng: -156.4392, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 5938 },
  { city: 'Pukalani', country: 'United States', state_province: 'Hawaii', lat: 20.8383, lng: -156.3367, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 7574 },
  { city: 'Kula', country: 'United States', state_province: 'Hawaii', lat: 20.7906, lng: -156.3239, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 6452 },
  
  // OAHU (adding notable spots not already included)
  { city: 'North Shore', country: 'United States', state_province: 'Hawaii', lat: 21.6400, lng: -158.0628, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 18500 },
  { city: 'Haleiwa', country: 'United States', state_province: 'Hawaii', lat: 21.5936, lng: -158.1039, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 4500 },
  { city: 'Waikiki', country: 'United States', state_province: 'Hawaii', lat: 21.2793, lng: -157.8293, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 25000 },
  { city: 'Laie', country: 'United States', state_province: 'Hawaii', lat: 21.6458, lng: -157.9222, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 6138 },
  { city: 'Hauula', country: 'United States', state_province: 'Hawaii', lat: 21.6136, lng: -157.9097, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 4148 },
  { city: 'Waimanalo', country: 'United States', state_province: 'Hawaii', lat: 21.3414, lng: -157.7206, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 5451 },
  { city: 'Hawaii Kai', country: 'United States', state_province: 'Hawaii', lat: 21.2908, lng: -157.7078, timezone: 'Pacific/Honolulu', utc_offset: -10, population: 30000 },
]

// Read the existing CSV
let csv = fs.readFileSync(csvPath, 'utf-8')
const lines = csv.split('\n')

// Check which locations already exist
const existingCities = new Set<string>()
for (const line of lines) {
  const match = line.match(/^[^,]*,"([^"]+)","([^"]+)"/)
  if (match) {
    existingCities.add(`${match[1].toLowerCase()}|${match[2].toLowerCase()}`)
  }
}

// Filter to only new locations
const newLocations = hawaiiLocations.filter(loc => {
  const key = `${loc.city.toLowerCase()}|${loc.country.toLowerCase()}`
  return !existingCities.has(key)
})

console.log(`Found ${hawaiiLocations.length} Hawaii locations total`)
console.log(`${hawaiiLocations.length - newLocations.length} already exist in the dataset`)
console.log(`Adding ${newLocations.length} new Hawaii locations:\n`)

// Generate new CSV lines
const newLines: string[] = []
for (const loc of newLocations) {
  const line = [
    0,
    `"${loc.city}"`,
    `"${loc.country}"`,
    `"${loc.state_province}"`,
    loc.lat,
    loc.lng,
    loc.timezone,
    loc.utc_offset,
    loc.utc_offset,
    '',
    '',
    loc.population,
    '', '', '', '', ''
  ].join(',')
  
  newLines.push(line)
  console.log(`  + ${loc.city}, HI (pop: ${loc.population.toLocaleString()})`)
}

// Append the new lines to the CSV
if (newLines.length > 0) {
  if (!csv.endsWith('\n')) {
    csv += '\n'
  }
  csv += newLines.join('\n') + '\n'
  
  fs.writeFileSync(csvPath, csv)
  console.log(`\n✅ Added ${newLines.length} Hawaii locations to santa_seed.csv`)
} else {
  console.log('\n✅ All Hawaii locations already exist in the dataset')
}

