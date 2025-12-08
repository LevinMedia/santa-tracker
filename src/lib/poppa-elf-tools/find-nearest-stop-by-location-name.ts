import { tool } from '@openai/agents'
import { loadFlightData, haversineDistanceKm, FlightStop } from '@/lib/flight-data'
import { searchStopsByLocation } from '@/lib/flight-data'

// Rate limiting: Photon geocoding service - ensure at least 1 second between requests
// Use a promise queue to serialize requests and prevent race conditions
let requestQueue: Promise<number> = Promise.resolve(0) // Resolves with timestamp of last request completion
const MIN_REQUEST_INTERVAL = 1000 // 1 second in milliseconds

/**
 * Geocode a location using Photon geocoding service (open source, no API key required)
 * Photon is an alternative to Nominatim that's more permissive
 */
async function geocodeLocation(locationName: string): Promise<Array<{
  name: string
  display_name: string
  lat: number
  lon: number
  type: string
  importance?: number
}>> {
  // Rate limiting: use promise queue to serialize requests atomically
  // This prevents race conditions where multiple concurrent requests could
  // read the same lastRequestTime and violate the rate limit
  // Wait for previous request to complete and get its completion timestamp
  const lastRequestCompletionTime = await requestQueue
  
  // Calculate wait time based on when the last request actually completed
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestCompletionTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest))
  }
  
  // Create a new promise that will be awaited by the next request
  // This ensures requests are serialized and rate-limited properly
  let resolveNext: (timestamp: number) => void
  const nextRequestPromise = new Promise<number>((resolve) => {
    resolveNext = resolve
  })
  
  // Update the queue to point to this request's completion promise
  requestQueue = nextRequestPromise
  
  const encodedLocation = encodeURIComponent(locationName)
  // Use Photon geocoding service (open source, no API key needed)
  const url = `https://photon.komoot.io/api/?q=${encodedLocation}&limit=10`
  
  console.log(`[geocodeLocation] Fetching from Photon for: "${locationName}"`)
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })
  
  console.log(`[geocodeLocation] Response status: ${response.status}`)
  
  try {
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[geocodeLocation] API error ${response.status}: ${errorText.substring(0, 500)}`)
      throw new Error(`Geocoding API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Transform Photon format to match what we expect
    if (!data.features || !Array.isArray(data.features)) {
      // Resolve next request with current timestamp before returning
      resolveNext!(Date.now())
      return []
    }
    
    const result = data.features.map((feature: any) => ({
      name: feature.properties?.name || feature.properties?.display_name || locationName,
      display_name: feature.properties?.name || feature.properties?.display_name || locationName,
      lat: feature.geometry?.coordinates?.[1] || 0,
      lon: feature.geometry?.coordinates?.[0] || 0,
      type: feature.properties?.type || 'unknown',
      importance: feature.properties?.importance || 0,
    }))
    
    // Resolve next request with current timestamp after this one completes successfully
    resolveNext!(Date.now())
    return result
  } catch (error) {
    // Always resolve next request with current timestamp, even on error, to prevent queue from blocking
    resolveNext!(Date.now())
    throw error
  }
}

/**
 * Tool: Find nearest stop by location name
 * 
 * This is a combined tool that:
 * 1. First tries exact search in Santa's stop list
 * 2. If not found, geocodes the location name
 * 3. Finds the nearest stop to the geocoded coordinates
 * 
 * Use this when the user asks about a location (e.g., "When was Santa in Teahupoo?",
 * "Did Santa stop in Mount Everest?"). This tool handles the entire workflow automatically.
 */
export const findNearestStopByLocationNameTool = tool({
  name: 'find_nearest_stop_by_location_name',
  description: `Find the nearest stop from Santa's 2024 flight to a location name. This tool automatically: 1) First searches for exact matches in Santa's stop list, 2) If not found, geocodes the location name, 3) Finds the nearest stop to those coordinates. Use this when the user asks "When was Santa in [location]?" or "Did Santa stop in [location]?" - especially for locations that might not be in the exact stop list (e.g., "Teahupoo", "Mount Everest", specific landmarks). This is the PRIMARY tool to use for location queries that don't return exact matches.`,
  parameters: {
    type: 'object' as const,
    properties: {
      location_name: {
        type: 'string' as const,
        description: 'The location name to search for (e.g., "Teahupoo", "Mount Everest", "Springfield", "Paris")',
      },
    },
    required: ['location_name'] as const,
    additionalProperties: false as const,
  },
  strict: true,
  execute: async (input: unknown) => {
    console.log('[find_nearest_stop_by_location_name] Tool called with input:', JSON.stringify(input))
    const args = input as { location_name: string }
    const { location_name } = args
    
    if (!location_name || !location_name.trim()) {
      console.log('[find_nearest_stop_by_location_name] Error: No location name provided')
      return 'Please provide a location name to search for.'
    }
    
    const locationName = location_name.trim()
    console.log(`[find_nearest_stop_by_location_name] Searching for location: "${locationName}"`)
    
    // Step 1: Try exact search first (by city, then by country)
    console.log(`[find_nearest_stop_by_location_name] Step 1: Trying exact city search for "${locationName}"`)
    const exactMatches = searchStopsByLocation({
      city: locationName,
    })
    console.log(`[find_nearest_stop_by_location_name] Exact city matches: ${exactMatches.length}`)
    
    // If no city match, try country
    if (exactMatches.length === 0) {
      console.log(`[find_nearest_stop_by_location_name] Step 1b: Trying exact country search for "${locationName}"`)
      const countryMatches = searchStopsByLocation({
        country: locationName,
      })
      console.log(`[find_nearest_stop_by_location_name] Exact country matches: ${countryMatches.length}`)
      if (countryMatches.length > 0) {
        // Found exact country match - return it
        let response = `Found ${countryMatches.length} stop${countryMatches.length === 1 ? '' : 's'} in ${locationName}:\n\n`
        countryMatches.slice(0, 5).forEach((stop, index) => {
          const location = stop.state_province 
            ? `${stop.city}, ${stop.state_province}, ${stop.country}`
            : `${stop.city}, ${stop.country}`
          response += `${index + 1}. Stop ${stop.stop_number}: ${location}\n`
          response += `   Time: ${stop.local_time} (${stop.timezone})\n`
        })
        if (countryMatches.length > 5) {
          response += `\n... and ${countryMatches.length - 5} more stops`
        }
        return response.trim()
      }
    } else {
      // Found exact city match - return it
      let response = `Found ${exactMatches.length} stop${exactMatches.length === 1 ? '' : 's'} in ${locationName}:\n\n`
      exactMatches.forEach((stop, index) => {
        const location = stop.state_province 
          ? `${stop.city}, ${stop.state_province}, ${stop.country}`
          : `${stop.city}, ${stop.country}`
        response += `${index + 1}. Stop ${stop.stop_number}: ${location}\n`
        response += `   Time: ${stop.local_time} (${stop.timezone})\n`
        response += `   UTC Time: ${stop.utc_time}\n`
      })
      return response.trim()
    }
    
    // Step 2: No exact match - geocode the location
    console.log(`[find_nearest_stop_by_location_name] Step 2: No exact matches, geocoding "${locationName}"`)
    try {
      const candidates = await geocodeLocation(locationName)
      console.log(`[find_nearest_stop_by_location_name] Geocoding returned ${candidates.length} candidates`)
      
      if (candidates.length === 0) {
        console.log(`[find_nearest_stop_by_location_name] No geocoding results for "${locationName}"`)
        return `No locations found matching "${locationName}" in Santa's stop list or via geocoding. Please try a different location name.`
      }
      
      // If multiple candidates, use the one with highest importance (most likely match)
      const bestCandidate = candidates[0] // Nominatim returns sorted by relevance
      console.log(`[find_nearest_stop_by_location_name] Using best candidate: ${bestCandidate.display_name} at ${bestCandidate.lat}, ${bestCandidate.lon}`)
      
      // Step 3: Find nearest stop to the geocoded coordinates
      console.log(`[find_nearest_stop_by_location_name] Step 3: Finding nearest stop to coordinates ${bestCandidate.lat}, ${bestCandidate.lon}`)
      const stops = loadFlightData()
      console.log(`[find_nearest_stop_by_location_name] Loaded ${stops.length} stops from flight data`)
      if (stops.length === 0) {
        console.log('[find_nearest_stop_by_location_name] Error: No flight data available')
        return 'No flight data available.'
      }
      
      const lat = bestCandidate.lat
      const lon = bestCandidate.lon
      
      if (isNaN(lat) || isNaN(lon)) {
        console.log(`[find_nearest_stop_by_location_name] Error: Invalid coordinates ${bestCandidate.lat}, ${bestCandidate.lon}`)
        return `Invalid coordinates from geocoding: ${bestCandidate.lat}, ${bestCandidate.lon}`
      }
      
      // Find the nearest stop
      console.log(`[find_nearest_stop_by_location_name] Searching through ${stops.length} stops for nearest to (${lat}, ${lon})`)
      let nearestStop: FlightStop | null = null
      let minDistance = Infinity
      
      for (const stop of stops) {
        const distance = haversineDistanceKm(lat, lon, stop.lat, stop.lng)
        if (distance < minDistance) {
          minDistance = distance
          nearestStop = stop
        }
      }
      
      if (!nearestStop) {
        console.log('[find_nearest_stop_by_location_name] Error: Could not find nearest stop')
        return 'Could not find nearest stop.'
      }
      
      console.log(`[find_nearest_stop_by_location_name] Found nearest stop: ${nearestStop.city}, ${nearestStop.country} (stop ${nearestStop.stop_number}) at distance ${minDistance.toFixed(2)} km`)
      
      // Format the response
      const location = nearestStop.state_province 
        ? `${nearestStop.city}, ${nearestStop.state_province}, ${nearestStop.country}`
        : `${nearestStop.city}, ${nearestStop.country}`
      
      const distanceMiles = minDistance * 0.621371
      
      let response = `The last verified location where this Santa Tracker spotted the big guy near ${bestCandidate.name || bestCandidate.display_name || locationName} was:\n\n`
      response += `Stop ${nearestStop.stop_number}: ${location}\n`
      response += `Distance from ${bestCandidate.name || bestCandidate.display_name || locationName}: ${minDistance.toFixed(2)} km (${distanceMiles.toFixed(2)} miles)\n`
      response += `Time: ${nearestStop.local_time} (${nearestStop.timezone})\n`
      response += `UTC Time: ${nearestStop.utc_time}\n`
      response += `Coordinates: ${nearestStop.lat.toFixed(4)}, ${nearestStop.lng.toFixed(4)}\n`
      
      if (nearestStop.population) {
        response += `Population: ${nearestStop.population.toLocaleString()}\n`
      }
      
      if (nearestStop.temperature_c !== undefined) {
        const tempF = (nearestStop.temperature_c * 9/5) + 32
        response += `Temperature: ${tempF.toFixed(1)}°F (${nearestStop.temperature_c.toFixed(1)}°C)\n`
      }
      
      if (nearestStop.weather_condition) {
        response += `Weather: ${nearestStop.weather_condition}\n`
      }
      
      // If multiple candidates, mention it
      if (candidates.length > 1) {
        response += `\nNote: There were ${candidates.length} possible locations matching "${locationName}". I used the most likely match: ${bestCandidate.name || bestCandidate.display_name || locationName}`
      }
      
      console.log(`[find_nearest_stop_by_location_name] Successfully returning response for "${locationName}"`)
      return response.trim()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[find_nearest_stop_by_location_name] Error finding location "${locationName}":`, error)
      return `Error finding location "${locationName}": ${errorMessage}`
    }
  },
})

