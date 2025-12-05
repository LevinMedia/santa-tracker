import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

/**
 * Get weather data from Blob for specific stops or timezone
 * 
 * Blob structure:
 *   weather/2025/tz-14.json → { "1": {weather}, "2": {weather}, ... }
 */

interface WeatherData {
  temperature_c: number
  weather_condition: string
  wind_speed_mps: number
  wind_direction_deg: number
  wind_gust_mps?: number
}

// Cache blob URLs in memory to avoid repeated list calls
const blobUrlCache = new Map<string, string>()

async function getBlobUrl(year: number, timezone: number): Promise<string | null> {
  const cacheKey = `${year}:${timezone}`
  
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!
  }
  
  try {
    // List blobs to find the URL for this timezone
    const { blobs } = await list({ prefix: `weather/${year}/tz-${timezone}.json` })
    
    if (blobs.length > 0) {
      const url = blobs[0].url
      blobUrlCache.set(cacheKey, url)
      return url
    }
  } catch (error) {
    console.error(`Error listing blobs for tz-${timezone}:`, error)
  }
  
  return null
}

async function fetchWeatherFromBlob(url: string): Promise<Record<number, WeatherData> | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Error fetching weather blob:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timezoneParam = searchParams.get('timezone')
    const stopsParam = searchParams.get('stops')
    const yearParam = searchParams.get('year')
    
    const year = yearParam ? parseInt(yearParam) : 2025
    
    // If timezone provided, return all weather for that timezone
    if (timezoneParam) {
      const timezone = parseInt(timezoneParam)
      const blobUrl = await getBlobUrl(year, timezone)
      
      if (!blobUrl) {
        return NextResponse.json({ 
          success: true, 
          weather: {},
          message: `No weather data found for UTC${timezone >= 0 ? '+' : ''}${timezone}`
        })
      }
      
      const weatherData = await fetchWeatherFromBlob(blobUrl)
      
      return NextResponse.json({ 
        success: true,
        year,
        timezone,
        weather: weatherData || {}
      })
    }
    
    // If stops provided, need to figure out which timezones they belong to
    // For now, return empty - client should use timezone endpoint
    if (stopsParam) {
      return NextResponse.json({ 
        success: false,
        error: 'Use timezone parameter instead of stops for Blob storage'
      }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Provide timezone parameter' }, { status: 400 })
    
  } catch (error) {
    console.error('Error fetching weather from Blob:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}

// POST endpoint for fetching weather by timezone
export async function POST(request: NextRequest) {
  try {
    const { timezone, year = 2025 } = await request.json() as {
      timezone: number
      year?: number
    }
    
    if (timezone === undefined || timezone === null) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    const blobUrl = await getBlobUrl(year, timezone)
    
    if (!blobUrl) {
      return NextResponse.json({ 
        success: true, 
        weather: {},
        message: `No weather data found for UTC${timezone >= 0 ? '+' : ''}${timezone}`
      })
    }
    
    const weatherData = await fetchWeatherFromBlob(blobUrl)
    
    return NextResponse.json({ 
      success: true,
      year,
      timezone,
      weather: weatherData || {}
    })
    
  } catch (error) {
    console.error('Error fetching weather from Blob:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}
