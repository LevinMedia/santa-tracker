/**
 * Build-time script to extract flight window timestamps from CSV
 * 
 * Reads the live flight CSV and generates src/lib/flight-window.ts
 * with the start/end timestamps as constants.
 * 
 * Run: npx tsx scripts/generate-flight-window.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { join } from 'path'

// Configuration - which CSV file to use for live flight
const LIVE_FLIGHT_FILE = '2025_santa_tracker.csv'

interface FlightStop {
  stop_number: string
  utc_time: string
}

function parseUTCTime(utcTimeStr: string): number {
  // Parse "2025-12-02 10:00:00" format
  const normalized = utcTimeStr.replace(' ', 'T') + 'Z'
  return new Date(normalized).getTime()
}

async function main() {
  const csvPath = join(process.cwd(), 'public', LIVE_FLIGHT_FILE)
  console.log(`📖 Reading ${LIVE_FLIGHT_FILE}...`)
  
  const csvContent = readFileSync(csvPath, 'utf-8')
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as FlightStop[]
  
  if (records.length === 0) {
    throw new Error('No records found in CSV')
  }
  
  const firstStop = records[0]
  const lastStop = records[records.length - 1]
  
  const flightStart = parseUTCTime(firstStop.utc_time)
  const flightEnd = parseUTCTime(lastStop.utc_time)
  
  console.log(`✅ Found ${records.length} stops`)
  console.log(`   Start: ${firstStop.utc_time} (${new Date(flightStart).toISOString()})`)
  console.log(`   End:   ${lastStop.utc_time} (${new Date(flightEnd).toISOString()})`)
  
  // Generate the TypeScript file
  const outputContent = `/**
 * AUTO-GENERATED - Do not edit manually
 * Generated from: ${LIVE_FLIGHT_FILE}
 * Run: npx tsx scripts/generate-flight-window.ts
 */

/** Live flight CSV file name (without path) */
export const LIVE_FLIGHT_FILE = '${LIVE_FLIGHT_FILE.replace('.csv', '')}'

/** Flight start timestamp (first stop UTC time) */
export const FLIGHT_START = ${flightStart}

/** Flight end timestamp (last stop UTC time) */
export const FLIGHT_END = ${flightEnd}

/** Human-readable flight window */
export const FLIGHT_WINDOW = {
  start: '${firstStop.utc_time}',
  end: '${lastStop.utc_time}',
  startISO: '${new Date(flightStart).toISOString()}',
  endISO: '${new Date(flightEnd).toISOString()}',
}
`

  const outputPath = join(process.cwd(), 'src', 'lib', 'flight-window.ts')
  writeFileSync(outputPath, outputContent)
  console.log(`📝 Generated: src/lib/flight-window.ts`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

