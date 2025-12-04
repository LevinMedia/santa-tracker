/**
 * Live weather fetching for Santa Tracker
 * Calls server-side API to keep Open-Meteo API key private
 */

export interface WeatherData {
  temperature_c: number
  weather_condition: string
  wind_speed_mps: number
  wind_direction_deg: number
  wind_gust_mps?: number
}

/**
 * Fetch weather for a batch of locations via server API
 * API key is kept server-side for security
 */
export async function fetchWeatherBatch(
  locations: Array<{ lat: number; lng: number; index: number }>
): Promise<Map<number, WeatherData>> {
  const results = new Map<number, WeatherData>()
  
  if (locations.length === 0) return results
  
  console.log(`🌤️ Requesting weather for ${locations.length} locations...`)
  
  try {
    const response = await fetch('/api/weather/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations })
    })
    
    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`)
      return results
    }
    
    const data = await response.json()
    
    if (data.success && data.weather) {
      // Convert object to Map
      Object.entries(data.weather).forEach(([indexStr, weather]) => {
        const index = parseInt(indexStr)
        results.set(index, weather as WeatherData)
      })
      console.log(`🌤️ Weather received for ${results.size} locations`)
    }
  } catch (error) {
    console.error('Error fetching weather:', error)
  }
  
  return results
}

/**
 * Get all stops for a specific timezone offset
 */
export function getStopsForTimezone<T extends { utc_offset_rounded?: number }>(
  stops: T[],
  utcOffset: number
): T[] {
  return stops.filter(stop => stop.utc_offset_rounded === utcOffset)
}

/**
 * Get unique timezone offsets from stops, sorted descending (UTC+14 first)
 */
export function getTimezoneOffsets<T extends { utc_offset_rounded?: number }>(
  stops: T[]
): number[] {
  const offsets = new Set<number>()
  stops.forEach(stop => {
    if (stop.utc_offset_rounded !== undefined) {
      offsets.add(stop.utc_offset_rounded)
    }
  })
  return Array.from(offsets).sort((a, b) => b - a)
}

/**
 * Determine the next timezone based on current stop
 */
export function getNextTimezone<T extends { utc_offset_rounded?: number }>(
  stops: T[],
  currentStopIndex: number
): number | null {
  const currentOffset = stops[currentStopIndex]?.utc_offset_rounded
  if (currentOffset === undefined) return null
  
  // Look ahead for the next different timezone
  for (let i = currentStopIndex + 1; i < stops.length; i++) {
    const nextOffset = stops[i].utc_offset_rounded
    if (nextOffset !== undefined && nextOffset !== currentOffset) {
      return nextOffset
    }
  }
  
  return null
}

