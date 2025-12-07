import { tool } from '@openai/agents'
import { getStopByNumber } from '@/lib/flight-data'

/**
 * Tool: Get stop by number
 * 
 * Retrieves detailed information about a specific stop from Santa's 2024 flight
 * by stop number. Use this when the user asks about a specific stop number.
 */
export const getStopByNumberTool = tool({
  name: 'get_stop_by_number',
  description: `Get detailed information about a specific stop from Santa's 2024 flight by stop number. Use this when the user asks about a specific stop number (e.g., "What was stop number 1000?" or "Tell me about stop 500").`,
  parameters: {
    type: 'object' as const,
    properties: {
      stop_number: {
        type: 'number' as const,
        description: 'The stop number to look up (e.g., 1000, 500, 2500)',
      },
    },
    required: ['stop_number'],
    additionalProperties: false as const,
  },
  strict: true,
  execute: async (input: unknown) => {
    const args = input as { stop_number: number }
    const { stop_number } = args
    const stop = getStopByNumber(stop_number)
    
    if (!stop) {
      return `Stop number ${stop_number} was not found in Santa's 2024 flight records.`
    }
    
    // Format the stop data in a readable way
    const location = stop.state_province 
      ? `${stop.city}, ${stop.state_province}, ${stop.country}`
      : `${stop.city}, ${stop.country}`
    
    let response = `Stop ${stop.stop_number}: ${location}\n`
    response += `Time: ${stop.local_time} (${stop.timezone})\n`
    response += `UTC Time: ${stop.utc_time}\n`
    response += `Coordinates: ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}\n`
    
    if (stop.population) {
      response += `Population: ${stop.population.toLocaleString()}\n`
    }
    
    if (stop.temperature_c !== undefined) {
      const tempF = (stop.temperature_c * 9/5) + 32
      response += `Temperature: ${tempF.toFixed(1)}°F (${stop.temperature_c.toFixed(1)}°C)\n`
    }
    
    if (stop.weather_condition) {
      response += `Weather: ${stop.weather_condition}\n`
    }
    
    if (stop.wind_speed_mps !== undefined) {
      const windMph = stop.wind_speed_mps * 2.237
      response += `Wind: ${windMph.toFixed(1)} mph (${stop.wind_speed_mps.toFixed(1)} m/s)`
      if (stop.wind_direction_deg !== undefined) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        const dirIndex = Math.round(stop.wind_direction_deg / 22.5) % 16
        response += ` from ${directions[dirIndex]}`
      }
    }
    
    return response
  },
})

