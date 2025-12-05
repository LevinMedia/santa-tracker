/**
 * Weather utilities for Santa Tracker
 */

export interface WeatherData {
  temperature_c: number
  weather_condition: string
  wind_speed_mps: number
  wind_direction_deg: number
  wind_gust_mps?: number
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
