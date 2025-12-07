/**
 * Add State/Province Column to Santa Tracker CSV
 * 
 * This script:
 * 1. Reads the worldcities.csv to get state/province data
 * 2. Adds a state_province column to the santa tracker CSV
 * 3. Populates it for US and Canada entries
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// Calculate distance between two points (for matching)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180
  const R = 6371 // km
  
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c
}

interface WorldCity {
  city: string
  lat: number
  lng: number
  country: string
  admin_name: string
}

async function main() {
  const year = process.argv[2] || '2025'
  const santaFile = path.join(__dirname, `../public/${year}_santa_tracker.csv`)
  const worldCitiesFile = path.join(__dirname, '../public/worldcities.csv')
  
  console.log(`🎅 Adding State/Province Column to ${year} Santa Tracker`)
  console.log('='.repeat(50) + '\n')
  
  // Load worldcities data for US and Canada
  console.log('📖 Loading worldcities.csv for US/Canada lookup...')
  const worldCitiesCSV = fs.readFileSync(worldCitiesFile, 'utf-8')
  const worldCitiesLines = worldCitiesCSV.trim().split('\n')
  
  // Build lookup maps
  // Key: "city_lowercase|country" -> array of {admin_name, lat, lng}
  const cityLookup = new Map<string, WorldCity[]>()
  
  for (let i = 1; i < worldCitiesLines.length; i++) {
    const values = parseCSVLine(worldCitiesLines[i])
    const country = values[4] || ''
    
    // Only process US and Canada
    if (country !== 'United States' && country !== 'Canada') continue
    
    const city = (values[0] || '').toLowerCase()
    const lat = parseFloat(values[2]) || 0
    const lng = parseFloat(values[3]) || 0
    const admin_name = values[7] || ''
    
    const key = `${city}|${country}`
    if (!cityLookup.has(key)) {
      cityLookup.set(key, [])
    }
    cityLookup.get(key)!.push({ city: values[0], lat, lng, country, admin_name })
  }
  
  console.log(`   Loaded ${cityLookup.size} unique city+country combinations\n`)
  
  // Load santa tracker
  console.log('📖 Loading santa tracker CSV...')
  const santaCSV = fs.readFileSync(santaFile, 'utf-8')
  const santaLines = santaCSV.trim().split('\n')
  
  // Parse header and add new column
  const header = santaLines[0]
  const headerFields = parseCSVLine(header)
  
  // Insert state_province after country (index 2)
  const newHeader = [
    ...headerFields.slice(0, 3), // stop_number, city, country
    'state_province',
    ...headerFields.slice(3)     // rest of fields
  ].join(',')
  
  console.log(`   Found ${santaLines.length - 1} stops\n`)
  
  // Process each line
  console.log('🔍 Looking up state/province for US and Canada entries...')
  const outputLines: string[] = [newHeader]
  
  let usMatched = 0
  let usUnmatched = 0
  let canadaMatched = 0
  let canadaUnmatched = 0
  let otherCountries = 0
  
  const unmatchedCities: string[] = []
  
  for (let i = 1; i < santaLines.length; i++) {
    const values = parseCSVLine(santaLines[i])
    const city = values[1] || ''
    const country = values[2] || ''
    const lat = parseFloat(values[3]) || 0
    const lng = parseFloat(values[4]) || 0
    
    let stateProvince = ''
    
    if (country === 'United States' || country === 'Canada') {
      const key = `${city.toLowerCase()}|${country}`
      const candidates = cityLookup.get(key)
      
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          // Single match
          stateProvince = candidates[0].admin_name
        } else {
          // Multiple matches - find closest by coordinates
          let closest = candidates[0]
          let minDist = haversineDistance(lat, lng, closest.lat, closest.lng)
          
          for (let j = 1; j < candidates.length; j++) {
            const dist = haversineDistance(lat, lng, candidates[j].lat, candidates[j].lng)
            if (dist < minDist) {
              minDist = dist
              closest = candidates[j]
            }
          }
          stateProvince = closest.admin_name
        }
        
        if (country === 'United States') usMatched++
        else canadaMatched++
      } else {
        // No match found
        if (country === 'United States') {
          usUnmatched++
          if (usUnmatched <= 20) unmatchedCities.push(`US: ${city}`)
        } else {
          canadaUnmatched++
          if (canadaUnmatched <= 10) unmatchedCities.push(`CA: ${city}`)
        }
      }
    } else {
      otherCountries++
    }
    
    // Build output line with new column
    // Insert state_province after country
    const outputValues = [
      values[0], // stop_number
      values[1] ? `"${values[1]}"` : '',  // city
      values[2] ? `"${values[2]}"` : '',  // country
      stateProvince ? `"${stateProvince}"` : '', // NEW: state_province
      ...values.slice(3) // rest of fields
    ]
    
    outputLines.push(outputValues.join(','))
  }
  
  console.log(`\n📊 Results:`)
  console.log(`   US cities matched: ${usMatched}`)
  console.log(`   US cities unmatched: ${usUnmatched}`)
  console.log(`   Canada cities matched: ${canadaMatched}`)
  console.log(`   Canada cities unmatched: ${canadaUnmatched}`)
  console.log(`   Other countries (no lookup needed): ${otherCountries}`)
  
  if (unmatchedCities.length > 0) {
    console.log(`\n⚠️  Sample unmatched cities:`)
    unmatchedCities.forEach(c => console.log(`      ${c}`))
  }
  
  // Write output
  console.log('\n💾 Writing updated CSV...')
  fs.writeFileSync(santaFile, outputLines.join('\n'))
  console.log(`   Written to: ${santaFile}`)
  
  console.log('\n✅ Done!')
}

main().catch(console.error)



