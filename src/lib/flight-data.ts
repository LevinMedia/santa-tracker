import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Flight stop data structure matching the CSV format
 */
export interface FlightStop {
  stop_number: number
  city: string
  country: string
  state_province?: string
  lat: number
  lng: number
  timezone: string
  utc_offset: string
  utc_offset_rounded: number
  utc_time: string
  local_time: string
  population?: number
  temperature_c?: number
  weather_condition?: string
  wind_speed_mps?: number
  wind_direction_deg?: number
  wind_gust_mps?: number
}

/**
 * Parse a CSV line handling quoted fields
 */
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

/**
 * Parse the 2024 Santa Tracker CSV file
 * CSV columns: 0-stop_number, 1-city, 2-country, 3-state_province, 4-lat, 5-lng, 6-timezone,
 *              7-utc_offset, 8-utc_offset_rounded, 9-utc_time, 10-local_time, 11-population
 *              12-temperature_c, 13-weather_condition, 14-wind_speed_mps, 15-wind_direction_deg, 16-wind_gust_mps
 */
function parseFlightData(csvContent: string): FlightStop[] {
  const lines = csvContent.trim().split('\n')
  const stops: FlightStop[] = []
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const values = parseCSVLine(line)
    
    // Parse required fields
    const stop_number = parseInt(values[0], 10)
    const lat = parseFloat(values[4])
    const lng = parseFloat(values[5])
    
    // Skip invalid rows
    if (isNaN(stop_number) || isNaN(lat) || isNaN(lng)) continue
    
    const stop: FlightStop = {
      stop_number,
      city: values[1] || 'Unknown',
      country: values[2] || 'Unknown',
      state_province: values[3] || undefined,
      lat,
      lng,
      timezone: values[6] || '',
      utc_offset: values[7] || '',
      utc_offset_rounded: parseInt(values[8], 10) || 0,
      utc_time: values[9] || '',
      local_time: values[10] || '',
      population: values[11] ? parseInt(values[11], 10) : undefined,
      temperature_c: values[12] ? parseFloat(values[12]) : undefined,
      weather_condition: values[13] || undefined,
      wind_speed_mps: values[14] ? parseFloat(values[14]) : undefined,
      wind_direction_deg: values[15] ? parseFloat(values[15]) : undefined,
      wind_gust_mps: values[16] ? parseFloat(values[16]) : undefined,
    }
    
    stops.push(stop)
  }
  
  return stops
}

// Cache for parsed flight data
let cachedStops: FlightStop[] | null = null

/**
 * Load and cache flight data from the CSV file
 * This is called once and cached in memory for performance
 */
export function loadFlightData(): FlightStop[] {
  if (cachedStops) {
    return cachedStops
  }
  
  const csvPath = join(process.cwd(), 'public', '2024_santa_tracker.csv')
  const csvContent = readFileSync(csvPath, 'utf-8')
  cachedStops = parseFlightData(csvContent)
  
  return cachedStops
}

/**
 * Get a specific stop by stop number
 * @param stopNumber The stop number to look up
 * @returns The flight stop data or null if not found
 */
export function getStopByNumber(stopNumber: number): FlightStop | null {
  const stops = loadFlightData()
  const stop = stops.find(s => s.stop_number === stopNumber)
  return stop || null
}

/**
 * Search stops by location (exact match)
 * @param options Search options with city, country, and/or state_province
 * @returns Array of matching flight stops
 */
export function searchStopsByLocation(options: {
  city?: string
  country?: string
  state_province?: string
}): FlightStop[] {
  const stops = loadFlightData()
  
  return stops.filter(stop => {
    if (options.city && stop.city.toLowerCase() !== options.city.toLowerCase()) {
      return false
    }
    if (options.country && stop.country.toLowerCase() !== options.country.toLowerCase()) {
      return false
    }
    if (options.state_province) {
      if (!stop.state_province || stop.state_province.toLowerCase() !== options.state_province.toLowerCase()) {
        return false
      }
    }
    return true
  })
}

