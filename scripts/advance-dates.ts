/**
 * Advance all dates in 2025_santa_tracker.csv by a specified number of days
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DAYS_TO_ADD = -1 // Go back 1 day

const inputFile = path.join(__dirname, '../public/2025_santa_tracker.csv')

console.log(`📅 Advancing dates by ${DAYS_TO_ADD} day(s) in 2025_santa_tracker.csv...\n`)

const csv = fs.readFileSync(inputFile, 'utf-8')
const lines = csv.split('\n')

const outputLines: string[] = []

// Keep header as-is
outputLines.push(lines[0])

function advanceDate(dateStr: string, days: number): string {
  // Parse date like "2025-12-04 09:25:11"
  const date = new Date(dateStr.replace(' ', 'T') + 'Z')
  date.setUTCDate(date.getUTCDate() + days)
  
  // Format back to "YYYY-MM-DD HH:MM:SS"
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

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
  
  // Update utc_time (index 8) and local_time (index 9)
  values[8] = advanceDate(values[8], DAYS_TO_ADD)
  values[9] = advanceDate(values[9], DAYS_TO_ADD)
  
  outputLines.push(values.join(','))
}

fs.writeFileSync(inputFile, outputLines.join('\n'))

console.log(`✅ Done! Advanced dates by ${DAYS_TO_ADD} day(s) for ${outputLines.length - 1} stops.`)
console.log(`   Written to: ${inputFile}`)

// Show first few lines as preview
console.log('\n📋 Preview of first 3 stops:')
for (let i = 1; i <= 3; i++) {
  console.log(outputLines[i])
}

