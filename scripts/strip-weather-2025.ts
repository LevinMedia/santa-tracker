/**
 * Strip weather data from 2025_santa_tracker.csv
 * Leaves the weather columns empty for live weather fetching later
 */

import * as fs from 'fs'
import * as path from 'path'

const inputFile = path.join(__dirname, '../public/2025_santa_tracker.csv')

console.log('🌤️  Stripping weather data from 2025_santa_tracker.csv...\n')

const csv = fs.readFileSync(inputFile, 'utf-8')
const lines = csv.split('\n')

const outputLines: string[] = []

// Keep header as-is
outputLines.push(lines[0])

// Process each data line
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  
  // Parse the CSV line (handle quoted fields)
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  
  // Keep first 11 columns (stop_number through population), clear weather columns
  // Columns: 0-stop_number, 1-city, 2-country, 3-lat, 4-lng, 5-timezone, 
  //          6-utc_offset, 7-utc_offset_rounded, 8-utc_time, 9-local_time, 10-population
  //          11-temperature_c, 12-weather_condition, 13-wind_speed_mps, 14-wind_direction_deg, 15-wind_gust_mps
  
  const outputValues = [
    values[0],  // stop_number
    values[1],  // city
    values[2],  // country
    values[3],  // lat
    values[4],  // lng
    values[5],  // timezone
    values[6],  // utc_offset
    values[7],  // utc_offset_rounded
    values[8],  // utc_time
    values[9],  // local_time
    values[10], // population
    '',         // temperature_c
    '',         // weather_condition
    '',         // wind_speed_mps
    '',         // wind_direction_deg
    '',         // wind_gust_mps
  ]
  
  outputLines.push(outputValues.join(','))
}

fs.writeFileSync(inputFile, outputLines.join('\n'))

console.log(`✅ Done! Stripped weather from ${outputLines.length - 1} stops.`)
console.log(`   Written to: ${inputFile}`)

