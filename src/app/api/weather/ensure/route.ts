import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-side weather ensuring endpoint
 * - Checks if weather already exists in Supabase for a timezone
 * - Only fetches if missing
 * - Stores weather in Supabase
 */

// In-memory lock to prevent concurrent fetches
const fetchingTimezones = new Set<number>()

// API key stays on server - never exposed to client
const OPENMETEO_API_KEY = process.env.OPEN_METEO_API_KEY
const API_BASE_URL = OPENMETEO_API_KEY 
  ? 'https://customer-api.open-meteo.com/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast'

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

function kmhToMps(kmh: number): number {
  return kmh / 3.6
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  try {
    const { timezone } = await request.json() as {
      timezone: number
    }
    
    if (timezone === undefined || timezone === null) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Check if this timezone already has weather data
    const { data: existingStops, error: checkError } = await supabase
      .from('live_weather')
      .select('stop_number, temperature_c')
      .eq('utc_offset_rounded', timezone)
    
    if (checkError) {
      console.error('Error checking existing weather:', checkError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    
    if (!existingStops || existingStops.length === 0) {
      return NextResponse.json({ 
        success: true, 
        status: 'no_stops',
        message: `No stops found for UTC${timezone >= 0 ? '+' : ''}${timezone}. Run sync script first.`
      })
    }
    
    // Count how many already have weather
    const stopsWithWeather = existingStops.filter(s => s.temperature_c !== null)
    
    // If most stops have weather (>90%), consider complete
    if (stopsWithWeather.length >= existingStops.length * 0.9) {
      console.log(`⏭️ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already has weather (${stopsWithWeather.length}/${existingStops.length})`)
      return NextResponse.json({ 
        success: true, 
        status: 'already_complete',
        message: `Weather for UTC${timezone >= 0 ? '+' : ''}${timezone} already fetched`,
        stopCount: existingStops.length,
        weatherCount: stopsWithWeather.length
      })
    }
    
    // In-memory lock
    if (fetchingTimezones.has(timezone)) {
      console.log(`⏳ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already being fetched`)
      return NextResponse.json({ 
        success: true, 
        status: 'in_progress',
        message: `Weather fetch already in progress for UTC${timezone >= 0 ? '+' : ''}${timezone}`
      })
    }
    
    fetchingTimezones.add(timezone)
    console.log(`🌤️ Fetching weather for UTC${timezone >= 0 ? '+' : ''}${timezone} (${existingStops.length - stopsWithWeather.length} stops need weather)`)
    
    try {
      // Get stops that need weather
      const { data: stopsNeedingWeather, error: fetchError } = await supabase
        .from('live_weather')
        .select('stop_number, lat, lng')
        .eq('utc_offset_rounded', timezone)
        .is('temperature_c', null)
      
      if (fetchError || !stopsNeedingWeather) {
        throw new Error('Failed to fetch stops needing weather')
      }
      
      const weatherUpdates: Array<{
        stop_number: number
        temperature_c: number
        weather_condition: string
        wind_speed_mps: number
        wind_direction_deg: number
        wind_gust_mps: number | null
        weather_fetched_at: string
      }> = []
      
      // Batch size - larger with API key
      const BATCH_SIZE = OPENMETEO_API_KEY ? 50 : 10
      const DELAY_BETWEEN_BATCHES = OPENMETEO_API_KEY ? 100 : 1500
      
      for (let i = 0; i < stopsNeedingWeather.length; i += BATCH_SIZE) {
        const batch = stopsNeedingWeather.slice(i, i + BATCH_SIZE)
        
        const lats = batch.map(l => l.lat.toFixed(4)).join(',')
        const lngs = batch.map(l => l.lng.toFixed(4)).join(',')
        
        const apiKeyParam = OPENMETEO_API_KEY ? `&apikey=${OPENMETEO_API_KEY}` : ''
        const url = `${API_BASE_URL}?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh${apiKeyParam}`
        
        // Retry logic
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
        
        const now = new Date().toISOString()
        
        responses.forEach((weatherData, idx) => {
          if (weatherData?.current) {
            const stop = batch[idx]
            weatherUpdates.push({
              stop_number: stop.stop_number,
              temperature_c: Math.round(weatherData.current.temperature_2m * 10) / 10,
              weather_condition: weatherCodeToCondition(weatherData.current.weather_code),
              wind_speed_mps: Math.round(kmhToMps(weatherData.current.wind_speed_10m) * 100) / 100,
              wind_direction_deg: weatherData.current.wind_direction_10m,
              wind_gust_mps: weatherData.current.wind_gusts_10m 
                ? Math.round(kmhToMps(weatherData.current.wind_gusts_10m) * 100) / 100 
                : null,
              weather_fetched_at: now,
            })
          }
        })
        
        // Delay between batches
        if (i + BATCH_SIZE < stopsNeedingWeather.length) {
          await delay(DELAY_BETWEEN_BATCHES)
        }
      }
      
      // Save weather to Supabase (update existing rows)
      if (weatherUpdates.length > 0) {
        // Update each stop individually (rows already exist from sync)
        for (const update of weatherUpdates) {
          const { error: updateError } = await supabase
            .from('live_weather')
            .update({
              temperature_c: update.temperature_c,
              weather_condition: update.weather_condition,
              wind_speed_mps: update.wind_speed_mps,
              wind_direction_deg: update.wind_direction_deg,
              wind_gust_mps: update.wind_gust_mps,
              weather_fetched_at: update.weather_fetched_at,
            })
            .eq('stop_number', update.stop_number)
          
          if (updateError) {
            console.error(`Error updating stop ${update.stop_number}:`, updateError)
          }
        }
        
        console.log(`💾 Saved weather to Supabase: ${weatherUpdates.length} stops for UTC${timezone >= 0 ? '+' : ''}${timezone}`)
      }
      
      fetchingTimezones.delete(timezone)
      
      return NextResponse.json({ 
        success: true, 
        status: 'fetched',
        message: `Weather fetched for UTC${timezone >= 0 ? '+' : ''}${timezone}`,
        stopCount: existingStops.length,
        fetchedCount: weatherUpdates.length
      })
      
    } catch (error) {
      fetchingTimezones.delete(timezone)
      throw error
    }
    
  } catch (error) {
    console.error('Error in weather ensure API:', error)
    return NextResponse.json({ error: 'Failed to ensure weather' }, { status: 500 })
  }
}
