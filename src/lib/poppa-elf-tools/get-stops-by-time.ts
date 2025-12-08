import { tool } from '@openai/agents'
import { searchStopsByUTCTime, parseTime, parseTimezone, localTimeToUTC } from '@/lib/flight-data'

/**
 * Tool: Get stops by time
 * 
 * Searches for stops in Santa's 2024 flight at a specific time.
 * Converts the query time to UTC, then finds all stops at that UTC moment,
 * showing what the local time was at each stop.
 * 
 * Example: "Where was Santa at 10pm in California?"
 * - 10pm PST = 6am UTC (next day)
 * - Finds all stops at 6am UTC
 * - Shows local time at each stop (e.g., 12am CST, 1am EST, etc.)
 */
export const getStopsByTimeTool = tool({
  name: 'get_stops_by_time',
  description: `Find stops in Santa's 2024 flight at a specific time. Use this when the user asks about where Santa was at a specific time in a specific timezone (e.g., "Where was Santa at 10pm EST?", "Where was Santa at 10pm in California?", "Where was Santa at 10pm PST?"). The tool converts the query time to UTC and finds all stops at that moment, showing what the local time was at each location. If no timezone is specified, assume UTC.`,
  parameters: {
    type: 'object' as const,
    properties: {
      time: {
        type: 'string' as const,
        description: 'The time to search for (e.g., "10pm", "10:00 PM", "22:00", "10am"). Can be in 12-hour or 24-hour format.',
      },
      timezone: {
        type: 'string' as const,
        description: 'The timezone for the query time (e.g., "EST", "PST", "UTC", "UTC-5", "California", "PST"). Required but can be empty string "" to assume UTC.',
      },
    },
    required: ['time', 'timezone'] as const,
    additionalProperties: false as const,
  },
  strict: true,
  execute: async (input: unknown) => {
    const args = input as { time: string; timezone: string }
    const { time, timezone } = args
    
    // Treat empty timezone as UTC
    const timezoneToUse = timezone?.trim() || ''
    
    // Parse the time
    const localHour = parseTime(time)
    if (localHour === null) {
      return `I couldn't understand the time "${time}". Please provide a time like "10pm", "10:00 PM", or "22:00".`
    }
    
    // Determine UTC offset for the query timezone
    let queryUTCOffset: number
    let timezoneLabel = ''
    
    if (timezoneToUse) {
      // Handle location names that map to timezones
      let timezoneToParse = timezoneToUse
      const tzLower = timezoneToUse.toLowerCase()
      if (tzLower.includes('california') || tzLower.includes('pacific')) {
        timezoneToParse = 'PST'
      } else if (tzLower.includes('new york') || tzLower.includes('eastern')) {
        timezoneToParse = 'EST'
      } else if (tzLower.includes('chicago') || tzLower.includes('central')) {
        timezoneToParse = 'CST'
      } else if (tzLower.includes('denver') || tzLower.includes('mountain')) {
        timezoneToParse = 'MST'
      }
      
      const parsed = parseTimezone(timezoneToParse)
      if (!parsed || parsed.length === 0) {
        return `I couldn't understand the timezone "${timezoneToUse}". Please use a format like "EST", "PST", "UTC", "UTC-5", or a location like "California".`
      }
      
      // If multiple offsets (like "USA"), use the first one as the query timezone
      // But actually, if someone says "10pm in USA", we should probably ask for clarification
      // For now, let's use the first offset
      queryUTCOffset = parsed[0]
      timezoneLabel = timezoneToUse.toUpperCase()
    } else {
      // No timezone specified - default to UTC
      queryUTCOffset = 0
      timezoneLabel = 'UTC'
    }
    
    // Convert local time to UTC
    const utcHour = localTimeToUTC(localHour, queryUTCOffset)
    
    // Search for stops at this UTC time
    const stops = searchStopsByUTCTime(utcHour)
    
    if (stops.length === 0) {
      return `No stops found at ${time} ${timezoneLabel} (${utcHour}:00 UTC) in Santa's 2024 flight records.`
    }
    
    // Group stops by country and state/province for a summary view
    const byLocation = new Map<string, typeof stops>()
    
    stops.forEach(stop => {
      // Create a location key: "Country" or "State/Province, Country"
      const locationKey = stop.state_province 
        ? `${stop.state_province}, ${stop.country}`
        : stop.country
      
      if (!byLocation.has(locationKey)) {
        byLocation.set(locationKey, [])
      }
      byLocation.get(locationKey)!.push(stop)
    })
    
    // Format the results - concise summary by location
    let response = `At ${time} ${timezoneLabel} (${utcHour}:00 UTC), Santa visited:\n`
    
    // Sort locations by number of stops (most first)
    const sortedLocations = Array.from(byLocation.entries()).sort((a, b) => b[1].length - a[1].length)
    
    const locationList: string[] = []
    
    sortedLocations.forEach(([locationKey, locationStops]) => {
      const firstStop = locationStops[0]
      
      // Get local time for this location
      const localTimeMatch = firstStop.local_time.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})/)
      const localHourStr = localTimeMatch ? `${localTimeMatch[1]}:${localTimeMatch[2]}` : ''
      
      let locationInfo = locationKey
      if (localHourStr) {
        locationInfo += ` (${localHourStr})`
      }
      locationInfo += `: ${locationStops.length} stop${locationStops.length === 1 ? '' : 's'}`
      
      // Add sample city
      if (locationStops.length === 1) {
        locationInfo += ` - ${locationStops[0].city}`
      } else {
        locationInfo += ` - ${locationStops[0].city} + ${locationStops.length - 1} more`
      }
      
      locationList.push(locationInfo)
    })
    
    response += locationList.join('\n')
    
    return response.trim()
  },
})


