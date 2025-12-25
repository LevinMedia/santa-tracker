import { tool } from '@openai/agents'
import { searchStopsByRegion, REGION_BOUNDS, FlightStop, FlightYear } from '@/lib/flight-data'

/**
 * Tool: Search stops by geographic region
 * 
 * Finds stops in Santa's 2025 flight within a specific geographic region.
 * Supports common regions like "west coast", "east coast", "midwest", "Pacific Northwest",
 * "New England", continents, countries, etc.
 * 
 * Use this when the user asks about:
 * - "Where was Santa on the west coast?"
 * - "What stops were in the Pacific Northwest?"
 * - "How many stops did Santa make in Europe?"
 * - "Where was Santa in New England?"
 */
export const searchStopsByRegionTool = tool({
  name: 'search_stops_by_region',
  description: `Search for stops in Santa's 2025 flight by geographic region. Supports regions like "west coast", "east coast", "midwest", "Pacific Northwest", "New England", continents (e.g., "Europe", "Asia", "North America"), countries (e.g., "United States", "Canada", "Japan"), and other common geographic regions. Default to the 2025 data unless the user explicitly asks for 2024 to compare. Use this when the user asks about stops in a broad geographic area (e.g., "Where was Santa on the west coast?", "What stops were in Europe?", "How many stops in the Pacific Northwest?").`,
  parameters: {
    type: 'object' as const,
    properties: {
      region: {
        type: 'string' as const,
        description: 'The geographic region name (e.g., "west coast", "east coast", "midwest", "Pacific Northwest", "New England", "Europe", "Asia", "United States", "Canada", etc.). Case-insensitive.',
      },
      year: {
        type: 'number' as const,
        enum: [2024, 2025],
        description: 'Flight year to search. Defaults to 2025 unless the user requests 2024.',
      },
    },
    required: ['region'] as const,
    additionalProperties: false as const,
  },
  strict: true,
  execute: async (input: unknown) => {
    console.log('[search_stops_by_region] Tool called with input:', JSON.stringify(input))
    const args = input as { region: string; year?: FlightYear }
    const { region } = args
    const year: FlightYear = args.year === 2024 ? 2024 : 2025
    
    if (!region || !region.trim()) {
      console.log('[search_stops_by_region] Error: No region provided')
      return 'Please provide a region name to search for.'
    }
    
    const regionName = region.trim().toLowerCase()
    console.log(`[search_stops_by_region] Searching for region: "${regionName}"`)
    
    // Look up region bounds
    const bounds = REGION_BOUNDS[regionName]
    
    if (!bounds) {
      // Try to find a partial match
      const matchingRegion = Object.keys(REGION_BOUNDS).find(key => 
        key.includes(regionName) || regionName.includes(key)
      )
      
      if (matchingRegion) {
        console.log(`[search_stops_by_region] Found partial match: "${matchingRegion}"`)
        const matchedBounds = REGION_BOUNDS[matchingRegion]
        const stops = await searchStopsByRegion(matchedBounds, year)

        if (stops.length === 0) {
          return `No stops found in the ${matchingRegion} region during Santa's ${year} flight.`
        }
        
        return formatStopsResponse(stops, matchingRegion)
      }
      
      // List available regions
      const availableRegions = Object.keys(REGION_BOUNDS)
        .filter(key => !key.includes(' us')) // Remove duplicate "us" variants for cleaner list
        .slice(0, 20) // Limit to first 20
        .join(', ')
      
      console.log(`[search_stops_by_region] Region not found: "${regionName}"`)
      return `Region "${region}" not recognized. Available regions include: ${availableRegions}, and more. Please try a different region name.`
    }
    
    // Search for stops in the region
    console.log(`[search_stops_by_region] Found bounds for "${regionName}":`, bounds)
    const stops = await searchStopsByRegion(bounds, year)
    console.log(`[search_stops_by_region] Found ${stops.length} stops in region`)

    if (stops.length === 0) {
      return `No stops found in the ${region} region during Santa's ${year} flight.`
    }

    return formatStopsResponse(stops, region, year)
  },
})

/**
 * Format stops response for display
 * For result sets with more than 5 stops, provides a summary instead of listing individual stops
 */
function formatStopsResponse(stops: FlightStop[], region: string, year: FlightYear): string {
  const MAX_DISPLAY_STOPS = 5 // Maximum number of stops to show in detail
  
  // For large result sets, provide a summary
  if (stops.length > MAX_DISPLAY_STOPS) {
    // Get unique countries
    const countries = new Set<string>()
    stops.forEach(stop => {
      countries.add(stop.country)
    })
    
    const countryList = Array.from(countries).sort()
    const countryCount = countryList.length
    
    let response = `Oh my snowflakes! Santa visited ${countryList.length} countr${countryCount === 1 ? 'y' : 'ies'} in the ${region} region during his ${year} flight, for a total of ${stops.length.toLocaleString()} stop${stops.length === 1 ? '' : 's'}!\n\n`
    
    // Show a sample of countries (limit to first 10 for readability)
    const displayCountries = countryList.slice(0, 10)
    if (countryList.length <= 10) {
      response += `The countries he visited in ${region} were: ${countryList.join(', ')}.\n\n`
    } else {
      response += `Some of the countries he visited in ${region} include: ${displayCountries.join(', ')}, and ${countryList.length - 10} more.\n\n`
    }
    
    response += `Would you like to know about Santa's stops in a specific location within ${region}? Just ask me about a specific city or location, and I can tell you all about his visits there!`
    
    return response.trim()
  }
  
  // For smaller result sets (5 or fewer), show detailed list
  let response = `Found ${stops.length.toLocaleString()} stop${stops.length === 1 ? '' : 's'} in the ${region} region:\n\n`
  
  stops.forEach((stop, index) => {
    const location = stop.state_province 
      ? `${stop.city}, ${stop.state_province}, ${stop.country}`
      : `${stop.city}, ${stop.country}`
    
    response += `${index + 1}. Stop ${stop.stop_number}: ${location}\n`
    response += `   Time: ${stop.local_time} (${stop.timezone})\n`
    response += `   UTC Time: ${stop.utc_time}\n`
    
    if (stop.temperature_c !== undefined) {
      const tempF = (stop.temperature_c * 9/5) + 32
      response += `   Temperature: ${tempF.toFixed(1)}°F (${stop.temperature_c.toFixed(1)}°C)\n`
    }
    
    response += '\n'
  })
  
  return response.trim()
}

