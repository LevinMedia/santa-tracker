import * as fs from 'fs'
import * as path from 'path'

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

const v1File = path.join(__dirname, '../public/2024_santa_tracker_weather_v1.csv')
const targetFile = path.join(__dirname, '../public/2024_santa_tracker_weather.csv')

console.log('Reading v1 file for correct times...')
const v1Csv = fs.readFileSync(v1File, 'utf-8')
const v1Lines = v1Csv.trim().split('\n')

// Build lookup map: stop_number -> { utc_time, local_time }
const timesMap = new Map<number, { utc_time: string, local_time: string }>()
for (let i = 1; i < v1Lines.length; i++) {
  const values = parseCSVLine(v1Lines[i])
  const stopNumber = parseInt(values[0])
  const utc_time = values[8]
  const local_time = values[9]
  timesMap.set(stopNumber, { utc_time, local_time })
}
console.log(`  Loaded ${timesMap.size} time entries from v1`)

console.log('Reading target file...')
const targetCsv = fs.readFileSync(targetFile, 'utf-8')
const targetLines = targetCsv.trim().split('\n')
const header = targetLines[0]

console.log('Fixing times...')
const outputLines = [header]
let fixed = 0
let notFound = 0

for (let i = 1; i < targetLines.length; i++) {
  const values = parseCSVLine(targetLines[i])
  const stopNumber = parseInt(values[0])
  
  const times = timesMap.get(stopNumber)
  if (times) {
    values[8] = times.utc_time
    values[9] = times.local_time
    fixed++
  } else {
    notFound++
  }
  
  // Rebuild the line, quoting fields that need it
  const line = values.map((v, idx) => {
    // Quote city, country, weather_condition if they exist
    if ((idx === 1 || idx === 2 || idx === 12) && v && !v.startsWith('"')) {
      return `"${v}"`
    }
    return v
  }).join(',')
  
  outputLines.push(line)
}

console.log(`  Fixed: ${fixed}`)
console.log(`  Not found in v1: ${notFound}`)

fs.writeFileSync(targetFile, outputLines.join('\n'))
console.log(`\nDone! Updated ${targetFile}`)
