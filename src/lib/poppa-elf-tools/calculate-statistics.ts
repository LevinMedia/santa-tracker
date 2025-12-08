import { tool } from '@openai/agents'
import { loadFlightData, searchStopsByLocation, haversineDistanceKm, FlightStop } from '@/lib/flight-data'

/**
 * Tool: Calculate statistics
 * 
 * Calculates various statistics about Santa's 2024 flight, such as:
 * - Total number of stops
 * - Average speed
 * - Total distance traveled
 * - Statistics filtered by location (city, country, state/province)
 * 
 * Use this when the user asks about:
 * - "How many stops did Santa make?"
 * - "How many stops did Santa make in [location]?"
 * - "What was Santa's average speed?"
 * - "What was Santa's average speed while traveling through [location]?"
 * - "How far did Santa travel?"
 */
export const calculateStatisticsTool = tool({
  name: 'calculate_statistics',
  description: `Calculate statistics about Santa's 2024 flight. Use this when the user asks about total stops, average speed, distance traveled, or statistics filtered by location (e.g., "How many stops did Santa make?", "How many stops in California?", "What was Santa's average speed through California?"). You can filter by city, country, or state/province.`,
  parameters: {
    type: 'object' as const,
    properties: {
      city: {
        type: 'string' as const,
        description: 'Filter by city name (exact match, case-insensitive). Optional.',
      },
      country: {
        type: 'string' as const,
        description: 'Filter by country name (exact match, case-insensitive). Optional.',
      },
      state_province: {
        type: 'string' as const,
        description: 'Filter by state or province name (exact match, case-insensitive). Optional.',
      },
      include_total_stops: {
        type: 'boolean' as const,
        description: 'Whether to include total number of stops in the results. Default: true.',
      },
      include_average_speed: {
        type: 'boolean' as const,
        description: 'Whether to include average speed calculation. Default: true.',
      },
      include_total_distance: {
        type: 'boolean' as const,
        description: 'Whether to include total distance traveled. Default: true.',
      },
    },
    required: [] as const,
    additionalProperties: false as const,
  },
  strict: false,
  execute: async (input: unknown) => {
    const args = input as {
      city?: string
      country?: string
      state_province?: string
      include_total_stops?: boolean
      include_average_speed?: boolean
      include_total_distance?: boolean
    }
    
    const {
      city,
      country,
      state_province,
      include_total_stops = true,
      include_average_speed = true,
      include_total_distance = true,
    } = args

    // Get stops (filtered if location specified)
    let stops: FlightStop[]
    if (city || country || state_province) {
      stops = searchStopsByLocation({
        city: city?.trim(),
        country: country?.trim(),
        state_province: state_province?.trim(),
      })
    } else {
      stops = loadFlightData()
    }

    if (stops.length === 0) {
      const locationParts: string[] = []
      if (city) locationParts.push(`city "${city}"`)
      if (state_province) locationParts.push(`state/province "${state_province}"`)
      if (country) locationParts.push(`country "${country}"`)
      
      const locationStr = locationParts.length > 0 
        ? ` in ${locationParts.join(', ')}`
        : ''
      
      return `No stops found${locationStr} in Santa's 2024 flight records.`
    }

    const results: string[] = []
    
    // Total stops
    if (include_total_stops) {
      const locationParts: string[] = []
      if (city) locationParts.push(city)
      if (state_province) locationParts.push(state_province)
      if (country) locationParts.push(country)
      
      const locationStr = locationParts.length > 0 
        ? ` in ${locationParts.join(', ')}`
        : ''
      
      results.push(`Total stops${locationStr}: ${stops.length.toLocaleString()}`)
    }

    // Calculate distance and speed (need at least 2 stops)
    if (stops.length >= 2 && (include_average_speed || include_total_distance)) {
      let totalDistanceKm = 0
      let totalTimeMs = 0

      // Calculate distance and time for each leg
      for (let i = 0; i < stops.length - 1; i++) {
        const current = stops[i]
        const next = stops[i + 1]
        
        // Calculate distance
        const distanceKm = haversineDistanceKm(
          current.lat,
          current.lng,
          next.lat,
          next.lng
        )
        totalDistanceKm += distanceKm
        
        // Calculate time difference
        const currentTime = new Date(current.utc_time.replace(' ', 'T') + 'Z').getTime()
        const nextTime = new Date(next.utc_time.replace(' ', 'T') + 'Z').getTime()
        const timeDiffMs = nextTime - currentTime
        
        // Only add positive time differences (handle edge cases)
        if (timeDiffMs > 0) {
          totalTimeMs += timeDiffMs
        }
      }

      // Total distance
      if (include_total_distance) {
        const distanceMiles = totalDistanceKm * 0.621371
        const locationParts: string[] = []
        if (city) locationParts.push(city)
        if (state_province) locationParts.push(state_province)
        if (country) locationParts.push(country)
        
        const locationStr = locationParts.length > 0 
          ? ` through ${locationParts.join(', ')}`
          : ''
        
        results.push(`Total distance traveled${locationStr}: ${totalDistanceKm.toFixed(0).toLocaleString()} km (${distanceMiles.toFixed(0).toLocaleString()} miles)`)
      }

      // Average speed
      if (include_average_speed && totalTimeMs > 0) {
        const totalHours = totalTimeMs / (1000 * 60 * 60)
        const averageSpeedKmh = totalDistanceKm / totalHours
        const averageSpeedMph = averageSpeedKmh * 0.621371
        
        const locationParts: string[] = []
        if (city) locationParts.push(city)
        if (state_province) locationParts.push(state_province)
        if (country) locationParts.push(country)
        
        const locationStr = locationParts.length > 0 
          ? ` while traveling through ${locationParts.join(', ')}`
          : ''
        
        results.push(`Average speed${locationStr}: ${averageSpeedKmh.toFixed(0).toLocaleString()} km/h (${averageSpeedMph.toFixed(0).toLocaleString()} mph)`)
      }
    } else if (stops.length < 2 && (include_average_speed || include_total_distance)) {
      // Can't calculate speed/distance with less than 2 stops
      if (include_average_speed) {
        results.push('Average speed: Cannot calculate (need at least 2 stops)')
      }
      if (include_total_distance) {
        results.push('Total distance: Cannot calculate (need at least 2 stops)')
      }
    }

    return results.join('\n')
  },
} as any)

