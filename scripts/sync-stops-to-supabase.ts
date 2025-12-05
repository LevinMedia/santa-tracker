/**
 * Sync stops from 2025_santa_tracker.csv to Supabase live_weather table
 * 
 * This script:
 * 1. Reads all stops from the CSV
 * 2. Upserts them into the live_weather table (preserving any existing weather data)
 * 
 * Run: npx tsx scripts/sync-stops-to-supabase.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env vars from .env.local
config({ path: path.join(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface Stop {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  timezone: string
  utc_offset_rounded: number
  utc_time: string
  local_time: string
}

function parseCSV(csvContent: string): Stop[] {
  const lines = csvContent.split('\n')
  const stops: Stop[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    
    stops.push({
      stop_number: parseInt(values[0]),
      city: values[1],
      country: values[2],
      lat: parseFloat(values[3]),
      lng: parseFloat(values[4]),
      timezone: values[5],
      utc_offset_rounded: parseInt(values[7]),
      utc_time: values[8],
      local_time: values[9],
    })
  }
  
  return stops
}

async function syncStops() {
  console.log('🎅 Syncing stops from CSV to Supabase...\n')
  
  // Read CSV
  const csvPath = path.join(__dirname, '../public/2025_santa_tracker.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const stops = parseCSV(csvContent)
  
  console.log(`📖 Found ${stops.length} stops in CSV`)
  
  // Get unique timezones for summary
  const timezones = [...new Set(stops.map(s => s.utc_offset_rounded))].sort((a, b) => b - a)
  console.log(`🌍 Timezones: ${timezones.map(tz => `UTC${tz >= 0 ? '+' : ''}${tz}`).join(', ')}\n`)
  
  // Batch upsert in chunks of 1000
  const BATCH_SIZE = 1000
  let totalUpserted = 0
  
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE)
    
    const records = batch.map(stop => ({
      stop_number: stop.stop_number,
      city: stop.city,
      country: stop.country,
      lat: stop.lat,
      lng: stop.lng,
      timezone: stop.timezone,
      utc_offset_rounded: stop.utc_offset_rounded,
      utc_time: stop.utc_time.replace(' ', 'T') + 'Z',
      local_time: stop.local_time.replace(' ', 'T'),
    }))
    
    const { error } = await supabase
      .from('live_weather')
      .upsert(records, { 
        onConflict: 'stop_number',
        ignoreDuplicates: false 
      })
    
    if (error) {
      console.error(`❌ Error upserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      continue
    }
    
    totalUpserted += batch.length
    console.log(`✅ Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stops.length / BATCH_SIZE)} (${totalUpserted}/${stops.length} stops)`)
  }
  
  console.log(`\n🎉 Done! Synced ${totalUpserted} stops to Supabase`)
  
  // Show timezone breakdown
  console.log('\n📊 Stops per timezone:')
  for (const tz of timezones) {
    const count = stops.filter(s => s.utc_offset_rounded === tz).length
    console.log(`   UTC${tz >= 0 ? '+' : ''}${tz.toString().padStart(2, ' ')}: ${count.toString().padStart(5, ' ')} stops`)
  }
}

syncStops().catch(console.error)

