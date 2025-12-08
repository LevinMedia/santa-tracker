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

/**
 * Map of common US timezone abbreviations to UTC offsets (standard time)
 */
const US_TIMEZONE_OFFSETS: Record<string, number> = {
  'EST': -5,  // Eastern Standard Time
  'EDT': -4,  // Eastern Daylight Time
  'CST': -6,  // Central Standard Time
  'CDT': -5,  // Central Daylight Time
  'MST': -7,  // Mountain Standard Time
  'MDT': -6,  // Mountain Daylight Time
  'PST': -8,  // Pacific Standard Time
  'PDT': -7,  // Pacific Daylight Time
  'AKST': -9, // Alaska Standard Time
  'AKDT': -8, // Alaska Daylight Time
  'HST': -10, // Hawaii Standard Time
  'HAST': -10, // Hawaii-Aleutian Standard Time
}

/**
 * US timezone UTC offsets (standard time) for searching all US timezones
 */
const US_TIMEZONE_OFFSETS_LIST = [-5, -6, -7, -8, -9, -10] // EST, CST, MST, PST, AKST, HST

/**
 * Parse timezone string to UTC offset(s)
 * @param timezoneStr Timezone string (e.g., "EST", "UTC-5", "PST", "USA", "US")
 * @returns Array of UTC offsets to search, or null if invalid
 */
export function parseTimezone(timezoneStr: string): number[] | null {
  const tz = timezoneStr.trim().toUpperCase()
  
  // Handle "USA" or "US" - return all US timezone offsets
  if (tz === 'USA' || tz === 'US' || tz === 'UNITED STATES') {
    return US_TIMEZONE_OFFSETS_LIST
  }
  
  // Handle common US timezone abbreviations
  if (US_TIMEZONE_OFFSETS[tz]) {
    return [US_TIMEZONE_OFFSETS[tz]]
  }
  
  // Handle UTC offsets (e.g., "UTC-5", "UTC+8", "-5", "+8")
  const utcMatch = tz.match(/^UTC?([+-]?\d+)$/) || tz.match(/^([+-]?\d+)$/)
  if (utcMatch) {
    const offset = parseInt(utcMatch[1], 10)
    return [offset]
  }
  
  // Handle "UTC" explicitly
  if (tz === 'UTC' || tz === 'GMT') {
    return [0]
  }
  
  return null
}

/**
 * Parse time string to hour (0-23)
 * @param timeStr Time string (e.g., "10pm", "10:00 PM", "22:00", "10")
 * @returns Hour (0-23) or null if invalid
 */
export function parseTime(timeStr: string): number | null {
  const time = timeStr.trim().toLowerCase()
  
  // Handle formats like "10pm", "10 PM", "10:00pm", "10:00 PM"
  const pmMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(?:pm|p\.?m\.?)/)
  if (pmMatch) {
    let hour = parseInt(pmMatch[1], 10)
    if (hour === 12) hour = 12 // 12pm stays 12
    else if (hour < 12) hour += 12 // 1pm-11pm become 13-23
    return hour
  }
  
  // Handle formats like "10am", "10 AM", "10:00am", "10:00 AM"
  const amMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(?:am|a\.?m\.?)/)
  if (amMatch) {
    let hour = parseInt(amMatch[1], 10)
    if (hour === 12) hour = 0 // 12am becomes 0
    return hour
  }
  
  // Handle 24-hour format (e.g., "22:00", "22", "10:30")
  const hourMatch = time.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10)
    if (hour >= 0 && hour <= 23) {
      return hour
    }
  }
  
  return null
}

/**
 * Search stops by UTC time (hour only)
 * @param utcHour Hour in UTC (0-23)
 * @returns Array of matching flight stops
 */
export function searchStopsByUTCTime(utcHour: number): FlightStop[] {
  const stops = loadFlightData()
  
  return stops.filter(stop => {
    // Parse the UTC time to get the hour
    // Format: "2024-12-24 23:31:45"
    const timeMatch = stop.utc_time.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):\d{2}:\d{2}/)
    if (!timeMatch) {
      return false
    }
    
    const stopUTCHour = parseInt(timeMatch[1], 10)
    return stopUTCHour === utcHour
  })
}

/**
 * Convert local time to UTC hour
 * @param localHour Hour in local timezone (0-23)
 * @param utcOffset UTC offset (e.g., -8 for PST, -5 for EST)
 * @returns UTC hour (0-23), handling day rollover
 */
export function localTimeToUTC(localHour: number, utcOffset: number): number {
  // UTC = local - offset
  // e.g., 10pm PST (22:00, offset -8) = 22 - (-8) = 30 = 6am next day (6)
  let utcHour = localHour - utcOffset
  
  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24
  } else if (utcHour >= 24) {
    utcHour -= 24
  }
  
  return utcHour
}

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (deg: number) => deg * Math.PI / 180
  const R = 6371 // Earth's radius in km

  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Parse UTC time string to timestamp
 * @param utcTime UTC time string (e.g., "2024-12-24 23:31:45")
 * @returns Timestamp in milliseconds
 */
function parseUTCTime(utcTime: string): number {
  return new Date(utcTime.replace(' ', 'T') + 'Z').getTime()
}

/**
 * Geographic region bounds (lat/lng)
 */
export interface RegionBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * Map of common geographic regions to their lat/lng bounds
 */
export const REGION_BOUNDS: Record<string, RegionBounds> = {
  // US Regions
  'west coast': { minLat: 32.0, maxLat: 49.0, minLng: -125.0, maxLng: -116.0 },
  'west coast us': { minLat: 32.0, maxLat: 49.0, minLng: -125.0, maxLng: -116.0 },
  'east coast': { minLat: 25.0, maxLat: 47.0, minLng: -81.0, maxLng: -66.0 },
  'east coast us': { minLat: 25.0, maxLat: 47.0, minLng: -81.0, maxLng: -66.0 },
  'midwest': { minLat: 37.0, maxLat: 49.0, minLng: -102.0, maxLng: -81.0 },
  'midwest us': { minLat: 37.0, maxLat: 49.0, minLng: -102.0, maxLng: -81.0 },
  'pacific northwest': { minLat: 42.0, maxLat: 49.0, minLng: -125.0, maxLng: -116.0 },
  'pacific northwest us': { minLat: 42.0, maxLat: 49.0, minLng: -125.0, maxLng: -116.0 },
  'new england': { minLat: 41.0, maxLat: 47.0, minLng: -73.0, maxLng: -66.0 },
  'new england us': { minLat: 41.0, maxLat: 47.0, minLng: -73.0, maxLng: -66.0 },
  'south': { minLat: 25.0, maxLat: 37.0, minLng: -106.0, maxLng: -75.0 },
  'south us': { minLat: 25.0, maxLat: 37.0, minLng: -106.0, maxLng: -75.0 },
  'southwest': { minLat: 31.0, maxLat: 37.0, minLng: -125.0, maxLng: -103.0 },
  'southwest us': { minLat: 31.0, maxLat: 37.0, minLng: -125.0, maxLng: -103.0 },
  'southeast': { minLat: 25.0, maxLat: 37.0, minLng: -88.0, maxLng: -75.0 },
  'southeast us': { minLat: 25.0, maxLat: 37.0, minLng: -88.0, maxLng: -75.0 },
  'great plains': { minLat: 37.0, maxLat: 49.0, minLng: -106.0, maxLng: -95.0 },
  'great plains us': { minLat: 37.0, maxLat: 49.0, minLng: -106.0, maxLng: -95.0 },
  
  // Continents/Countries (broad regions)
  'north america': { minLat: 7.0, maxLat: 83.0, minLng: -180.0, maxLng: -52.0 },
  'south america': { minLat: -56.0, maxLat: 12.0, minLng: -82.0, maxLng: -34.0 },
  'europe': { minLat: 35.0, maxLat: 71.0, minLng: -10.0, maxLng: 40.0 },
  'asia': { minLat: -10.0, maxLat: 78.0, minLng: 26.0, maxLng: 180.0 },
  'africa': { minLat: -35.0, maxLat: 37.0, minLng: -18.0, maxLng: 52.0 },
  'oceania': { minLat: -50.0, maxLat: 0.0, minLng: 110.0, maxLng: 180.0 },
  'australia': { minLat: -44.0, maxLat: -10.0, minLng: 113.0, maxLng: 154.0 },
  
  // Specific countries/regions
  'united states': { minLat: 24.0, maxLat: 50.0, minLng: -125.0, maxLng: -66.0 },
  'canada': { minLat: 42.0, maxLat: 83.0, minLng: -141.0, maxLng: -52.0 },
  'mexico': { minLat: 14.0, maxLat: 33.0, minLng: -118.0, maxLng: -86.0 },
  'united kingdom': { minLat: 50.0, maxLat: 61.0, minLng: -8.0, maxLng: 2.0 },
  'france': { minLat: 42.0, maxLat: 51.0, minLng: -5.0, maxLng: 10.0 },
  'germany': { minLat: 47.0, maxLat: 55.0, minLng: 6.0, maxLng: 15.0 },
  'italy': { minLat: 36.0, maxLat: 47.0, minLng: 6.0, maxLng: 19.0 },
  'spain': { minLat: 36.0, maxLat: 44.0, minLng: -10.0, maxLng: 5.0 },
  'japan': { minLat: 24.0, maxLat: 46.0, minLng: 123.0, maxLng: 146.0 },
  'china': { minLat: 18.0, maxLat: 54.0, minLng: 73.0, maxLng: 135.0 },
  'india': { minLat: 6.0, maxLat: 36.0, minLng: 68.0, maxLng: 98.0 },
  'brazil': { minLat: -34.0, maxLat: 6.0, minLng: -74.0, maxLng: -32.0 },
  'russia': { minLat: 41.0, maxLat: 82.0, minLng: 19.0, maxLng: 180.0 },
}

/**
 * Search stops by geographic region using lat/lng bounds
 * @param bounds Region bounds (minLat, maxLat, minLng, maxLng)
 * @returns Array of matching flight stops within the bounds
 */
export function searchStopsByRegion(bounds: RegionBounds): FlightStop[] {
  const stops = loadFlightData()
  
  return stops.filter(stop => {
    return stop.lat >= bounds.minLat &&
           stop.lat <= bounds.maxLat &&
           stop.lng >= bounds.minLng &&
           stop.lng <= bounds.maxLng
  })
}

