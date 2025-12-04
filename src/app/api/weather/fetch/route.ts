import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side weather fetching to keep API key private
 */

interface OpenMeteoResponse {
  latitude: number
  longitude: number
  current: {
    temperature_2m: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
  }
}

// API key stays on server - never exposed to client
const OPENMETEO_API_KEY = process.env.OPEN_METEO_API_KEY
const API_BASE_URL = OPENMETEO_API_KEY 
  ? 'https://customer-api.open-meteo.com/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast'

// Map Open-Meteo weather codes to human-readable conditions
function weatherCodeToCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  }
  return conditions[code] || 'Unknown'
}

// Convert wind speed from km/h to m/s
function kmhToMps(kmh: number): number {
  return kmh / 3.6
}

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const { locations } = await request.json() as {
      locations: Array<{ lat: number; lng: number; index: number }>
    }
    
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json({ error: 'No locations provided' }, { status: 400 })
    }
    
    const results: Record<number, {
      temperature_c: number
      weather_condition: string
      wind_speed_mps: number
      wind_direction_deg: number
      wind_gust_mps?: number
    }> = {}
    
    // Batch size - larger with API key
    const BATCH_SIZE = OPENMETEO_API_KEY ? 50 : 10
    const DELAY_BETWEEN_BATCHES = OPENMETEO_API_KEY ? 100 : 1500
    
    console.log(`🌤️ Server: Fetching weather for ${locations.length} locations (batch: ${BATCH_SIZE}, hasKey: ${!!OPENMETEO_API_KEY})`)
    
    for (let i = 0; i < locations.length; i += BATCH_SIZE) {
      const batch = locations.slice(i, i + BATCH_SIZE)
      
      const lats = batch.map(l => l.lat.toFixed(4)).join(',')
      const lngs = batch.map(l => l.lng.toFixed(4)).join(',')
      
      const apiKeyParam = OPENMETEO_API_KEY ? `&apikey=${OPENMETEO_API_KEY}` : ''
      const url = `${API_BASE_URL}?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh${apiKeyParam}`
      
      // Retry logic for rate limits
      let response: Response | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(url)
          
          if (response.status === 429) {
            const waitTime = Math.pow(2, attempt + 1) * 1000
            console.log(`⏳ Rate limited, waiting ${waitTime/1000}s...`)
            await delay(waitTime)
            continue
          }
          break
        } catch (error) {
          console.error(`Fetch attempt ${attempt + 1} failed:`, error)
          if (attempt < 2) await delay(1000)
        }
      }
      
      if (!response || !response.ok) {
        console.error(`Weather API error for batch ${Math.floor(i/BATCH_SIZE) + 1}`)
        continue
      }
      
      const data = await response.json()
      const responses: OpenMeteoResponse[] = Array.isArray(data) ? data : [data]
      
      responses.forEach((weatherData, idx) => {
        if (weatherData?.current) {
          const loc = batch[idx]
          results[loc.index] = {
            temperature_c: Math.round(weatherData.current.temperature_2m * 10) / 10,
            weather_condition: weatherCodeToCondition(weatherData.current.weather_code),
            wind_speed_mps: Math.round(kmhToMps(weatherData.current.wind_speed_10m) * 100) / 100,
            wind_direction_deg: weatherData.current.wind_direction_10m,
            wind_gust_mps: weatherData.current.wind_gusts_10m 
              ? Math.round(kmhToMps(weatherData.current.wind_gusts_10m) * 100) / 100 
              : undefined,
          }
        }
      })
      
      // Delay between batches
      if (i + BATCH_SIZE < locations.length) {
        await delay(DELAY_BETWEEN_BATCHES)
      }
    }
    
    console.log(`✅ Server: Weather fetched for ${Object.keys(results).length}/${locations.length} locations`)
    
    return NextResponse.json({ 
      success: true,
      weather: results,
      count: Object.keys(results).length
    })
    
  } catch (error) {
    console.error('Error in weather fetch API:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}

