import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Get weather data from Supabase for a timezone
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timezoneParam = searchParams.get('timezone')
    
    if (!timezoneParam) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    const timezone = parseInt(timezoneParam)
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('live_weather')
      .select('stop_number, temperature_c, weather_condition, wind_speed_mps, wind_direction_deg, wind_gust_mps')
      .eq('utc_offset_rounded', timezone)
      .not('temperature_c', 'is', null)
    
    if (error) {
      console.error('Error fetching weather from Supabase:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    
    // Convert to object keyed by stop_number
    const weather: Record<number, {
      temperature_c: number
      weather_condition: string
      wind_speed_mps: number
      wind_direction_deg: number
      wind_gust_mps: number | null
    }> = {}
    
    data?.forEach(row => {
      weather[row.stop_number] = {
        temperature_c: row.temperature_c,
        weather_condition: row.weather_condition,
        wind_speed_mps: row.wind_speed_mps,
        wind_direction_deg: row.wind_direction_deg,
        wind_gust_mps: row.wind_gust_mps,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      timezone,
      weather,
      count: Object.keys(weather).length
    })
    
  } catch (error) {
    console.error('Error in weather get API:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}

// POST endpoint for consistency with existing client code
export async function POST(request: NextRequest) {
  try {
    const { timezone } = await request.json() as { timezone: number }
    
    if (timezone === undefined || timezone === null) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('live_weather')
      .select('stop_number, temperature_c, weather_condition, wind_speed_mps, wind_direction_deg, wind_gust_mps')
      .eq('utc_offset_rounded', timezone)
      .not('temperature_c', 'is', null)
    
    if (error) {
      console.error('Error fetching weather from Supabase:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    
    // Convert to object keyed by stop_number
    const weather: Record<number, {
      temperature_c: number
      weather_condition: string
      wind_speed_mps: number
      wind_direction_deg: number
      wind_gust_mps: number | null
    }> = {}
    
    data?.forEach(row => {
      weather[row.stop_number] = {
        temperature_c: row.temperature_c,
        weather_condition: row.weather_condition,
        wind_speed_mps: row.wind_speed_mps,
        wind_direction_deg: row.wind_direction_deg,
        wind_gust_mps: row.wind_gust_mps,
      }
    })
    
    return NextResponse.json({ 
      success: true,
      timezone,
      weather,
      count: Object.keys(weather).length
    })
    
  } catch (error) {
    console.error('Error in weather get API:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}
