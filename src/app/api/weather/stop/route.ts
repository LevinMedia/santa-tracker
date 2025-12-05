import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fetch weather for a single stop and save to Supabase
 * Called in real-time as Santa arrives at each stop
 */

const OPENMETEO_API_KEY = process.env.OPEN_METEO_API_KEY
const API_BASE_URL = OPENMETEO_API_KEY 
  ? 'https://customer-api.open-meteo.com/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast'

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
    const { stop_number, lat, lng } = await request.json()
    
    if (!stop_number || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing stop_number, lat, or lng' }, { status: 400 })
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
    
    // Fetch weather from Open-Meteo
    const apiKeyParam = OPENMETEO_API_KEY ? `&apikey=${OPENMETEO_API_KEY}` : ''
    const url = `${API_BASE_URL}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh${apiKeyParam}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Open-Meteo API error:', response.status)
      return NextResponse.json({ error: 'Weather API error' }, { status: 502 })
    }
    
    const data = await response.json()
    
    if (!data.current) {
      return NextResponse.json({ error: 'No weather data' }, { status: 404 })
    }
    
    const weather = {
      temperature_c: Math.round(data.current.temperature_2m * 10) / 10,
      weather_condition: weatherCodeToCondition(data.current.weather_code),
      wind_speed_mps: Math.round((data.current.wind_speed_10m / 3.6) * 100) / 100,
      wind_direction_deg: data.current.wind_direction_10m,
      wind_gust_mps: data.current.wind_gusts_10m 
        ? Math.round((data.current.wind_gusts_10m / 3.6) * 100) / 100 
        : null,
    }
    
    // Save to Supabase
    const { error: updateError } = await supabase
      .from('live_weather')
      .update({
        ...weather,
        weather_fetched_at: new Date().toISOString(),
      })
      .eq('stop_number', stop_number)
    
    if (updateError) {
      console.error('Error saving weather:', updateError)
    }
    
    console.log(`🌤️ Fetched weather for stop ${stop_number}: ${weather.temperature_c}°C, ${weather.weather_condition}`)
    
    return NextResponse.json({ 
      success: true, 
      status: 'fetched',
      weather 
    })
    
  } catch (error) {
    console.error('Error in weather/stop API:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}

