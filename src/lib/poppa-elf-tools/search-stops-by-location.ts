import { tool } from '@openai/agents'
import { searchStopsByLocation, FlightYear } from '@/lib/flight-data'

/**
 * Tool: Search stops by location
 * 
 * Searches for stops in Santa's 2025 flight by city, country, or state/province.
 * Uses exact matching (case-insensitive). Use this when the user asks about
 * when Santa visited a specific location (e.g., "When was Santa in New York?",
 * "What stops were in France?", "When did Santa visit California?").
 */
export const searchStopsByLocationTool = tool({
  name: 'search_stops_by_location',
  description: `Search for stops in Santa's 2025 flight by city, country, or state/province using exact matching (case-insensitive). Use this when the user asks about when Santa visited a specific location and you know it's likely in the exact stop list (e.g., "When was Santa in New York?", "What stops were in France?"). Default to the 2025 data unless the user explicitly references 2024 for comparison. IMPORTANT: If this returns "No stops found", use find_nearest_stop_by_location_name instead - it will automatically geocode and find the nearest stop.`,
  parameters: {
    type: 'object' as const,
    properties: {
      city: {
        type: 'string' as const,
        description: 'The city name to search for (exact match, case-insensitive). Optional if searching by country or state/province.',
      },
      country: {
        type: 'string' as const,
        description: 'The country name to search for (exact match, case-insensitive). Optional if searching by city or state/province.',
      },
      state_province: {
        type: 'string' as const,
        description: 'The state or province name to search for (exact match, case-insensitive). Optional if searching by city or country.',
      },
      year: {
        type: 'number' as const,
        enum: [2024, 2025],
        description: 'Flight year to query. Defaults to 2025 unless the user asks for 2024.',
      },
    },
    required: [] as const,
    additionalProperties: false as const,
  },
  strict: false,
  execute: async (input: unknown) => {
    const args = input as { city?: string; country?: string; state_province?: string; year?: FlightYear }
    const { city, country, state_province } = args
    const year: FlightYear = args.year === 2024 ? 2024 : 2025
    
    // At least one search parameter must be provided
    if (!city && !country && !state_province) {
      return 'Please provide at least one search parameter: city, country, or state_province.'
    }
    
    const stops = await searchStopsByLocation({
      city: city?.trim(),
      country: country?.trim(),
      state_province: state_province?.trim(),
      year,
    })
    
    if (stops.length === 0) {
      const searchTerms = []
      if (city) searchTerms.push(`city "${city}"`)
      if (country) searchTerms.push(`country "${country}"`)
      if (state_province) searchTerms.push(`state/province "${state_province}"`)
      
      return `No stops found matching ${searchTerms.join(', ')} in Santa's ${year} flight records.`
    }
    
    const MAX_DISPLAY_STOPS = 5 // Maximum number of stops to show in detail
    
    // For large result sets, provide a summary
    if (stops.length > MAX_DISPLAY_STOPS) {
      // Get unique cities/locations
      const locations = new Set<string>()
      stops.forEach(stop => {
        const location = stop.state_province 
          ? `${stop.city}, ${stop.state_province}`
          : stop.city
        locations.add(location)
      })
      
      const locationList = Array.from(locations).sort()
      const locationCount = locationList.length
      
      // Build search description
      const searchDesc = []
      if (city) searchDesc.push(`city "${city}"`)
      if (state_province) searchDesc.push(`state/province "${state_province}"`)
      if (country) searchDesc.push(`country "${country}"`)
      const searchDescription = searchDesc.join(' in ')
      
      let response = `Oh my snowflakes! Santa made ${stops.length.toLocaleString()} stop${stops.length === 1 ? '' : 's'} in ${searchDescription} during his ${year} flight!\n\n`
      
      // Show a sample of locations (limit to first 10 for readability)
      const displayLocations = locationList.slice(0, 10)
      if (locationList.length <= 10) {
        response += `He visited ${locationList.length} location${locationCount === 1 ? '' : 's'}: ${locationList.join(', ')}.\n\n`
      } else {
        response += `He visited ${locationList.length} location${locationCount === 1 ? '' : 's'}, including: ${displayLocations.join(', ')}, and ${locationList.length - 10} more.\n\n`
      }
      
      response += `Would you like to know about Santa's stops at a specific location? Just ask me about a specific city or place, and I can tell you all about his visits there!`
      
      return response.trim()
    }
    
    // For smaller result sets (5 or fewer), show detailed list
    let response = `Found ${stops.length} stop${stops.length === 1 ? '' : 's'}:\n\n`
    
    stops.forEach((stop, index) => {
      const location = stop.state_province 
        ? `${stop.city}, ${stop.state_province}, ${stop.country}`
        : `${stop.city}, ${stop.country}`
      
      response += `${index + 1}. Stop ${stop.stop_number}: ${location}\n`
      response += `   Time: ${stop.local_time} (${stop.timezone})\n`
      response += `   UTC Time: ${stop.utc_time}\n`
      
      if (stop.population) {
        response += `   Population: ${stop.population.toLocaleString()}\n`
      }
      
      if (stop.temperature_c !== undefined) {
        const tempF = (stop.temperature_c * 9/5) + 32
        response += `   Temperature: ${tempF.toFixed(1)}°F (${stop.temperature_c.toFixed(1)}°C)\n`
      }
      
      if (stop.weather_condition) {
        response += `   Weather: ${stop.weather_condition}\n`
      }
      
      response += '\n'
    })
    
    return response.trim()
  },
} as any)

