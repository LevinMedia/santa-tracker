import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Backfill historical weather for a stop that was missed during live tracking
 * Uses Open-Meteo Archive API to get weather at the actual time Santa visited
 */

const OPENMETEO_API_KEY = process.env.OPEN_METEO_API_KEY

// Archive API for historical data
const ARCHIVE_API_URL = OPENMETEO_API_KEY 
  ? 'https://customer-archive-api.open-meteo.com/v1/archive'
  : 'https://archive-api.open-meteo.com/v1/archive'

function weatherCodeToCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
  }
  return conditions[code] || 'Unknown'
}

export async function POST(request: NextRequest) {
  try {
    const { stop_number, lat, lng, utc_time } = await request.json()
    
    if (!stop_number || lat === undefined || lng === undefined || !utc_time) {
      return NextResponse.json({ error: 'Missing stop_number, lat, lng, or utc_time' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Check if we already have weather for this stop
    const { data: existing } = await supabase
      .from('live_weather')
      .select('temperature_c')
      .eq('stop_number', stop_number)
      .single()
    
    if (existing?.temperature_c !== null && existing?.temperature_c !== undefined) {
      // Already have weather, return it
      const { data: weather } = await supabase
        .from('live_weather')
        .select('temperature_c, weather_condition, wind_speed_mps, wind_direction_deg, wind_gust_mps')
        .eq('stop_number', stop_number)
        .single()
      
      return NextResponse.json({ 
        success: true, 
        status: 'cached',
        weather 
      })
    }
    
    // Parse the UTC time to get date and hour
    // utc_time format: "2025-12-05 09:25:11" or "2025-12-05T09:25:11Z"
    const dateTime = new Date(utc_time.replace(' ', 'T') + (utc_time.includes('Z') ? '' : 'Z'))
    const date = dateTime.toISOString().split('T')[0] // YYYY-MM-DD
    const hour = dateTime.getUTCHours()
    
    // Fetch historical weather from Open-Meteo Archive API
    const apiKeyParam = OPENMETEO_API_KEY ? `&apikey=${OPENMETEO_API_KEY}` : ''
    const url = `${ARCHIVE_API_URL}?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode,wind_speed_10m,winddirection_10m,windgusts_10m${apiKeyParam}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Open-Meteo Archive API error:', response.status)
      return NextResponse.json({ error: 'Weather API error' }, { status: 502 })
    }
    
    const data = await response.json()
    
    if (!data.hourly || !data.hourly.temperature_2m) {
      return NextResponse.json({ error: 'No historical weather data' }, { status: 404 })
    }
    
    // Get the weather for the specific hour Santa visited
    const weather = {
      temperature_c: data.hourly.temperature_2m[hour] !== null 
        ? Math.round(data.hourly.temperature_2m[hour] * 10) / 10 
        : null,
      weather_condition: data.hourly.weathercode[hour] !== null
        ? weatherCodeToCondition(data.hourly.weathercode[hour])
        : null,
      wind_speed_mps: data.hourly.wind_speed_10m[hour] !== null
        ? Math.round((data.hourly.wind_speed_10m[hour] / 3.6) * 100) / 100
        : null,
      wind_direction_deg: data.hourly.winddirection_10m[hour] ?? null,
      wind_gust_mps: data.hourly.windgusts_10m[hour] !== null
        ? Math.round((data.hourly.windgusts_10m[hour] / 3.6) * 100) / 100
        : null,
    }
    
    // Only save if we got valid temperature data
    if (weather.temperature_c !== null) {
      const { error: updateError } = await supabase
        .from('live_weather')
        .update({
          ...weather,
          weather_fetched_at: new Date().toISOString(),
        })
        .eq('stop_number', stop_number)
      
      if (updateError) {
        console.error('Error saving backfill weather:', updateError)
      } else {
        console.log(`🌤️ Backfilled weather for stop ${stop_number}: ${weather.temperature_c}°C, ${weather.weather_condition}`)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      status: 'backfilled',
      weather 
    })
    
  } catch (error) {
    console.error('Error in weather/backfill API:', error)
    return NextResponse.json({ error: 'Failed to backfill weather' }, { status: 500 })
  }
}

