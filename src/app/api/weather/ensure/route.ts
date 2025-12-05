import { NextRequest, NextResponse } from 'next/server'
import { put, head } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

/**
 * Server-side weather ensuring endpoint
 * - Checks if weather already exists in Blob for a timezone
 * - Only fetches if missing
 * - Stores weather in Vercel Blob (survives serverless cold starts)
 * 
 * Blob structure:
 *   weather/2025/tz-14.json → { "1": {weather}, "2": {weather}, ... }
 */

// In-memory lock to prevent concurrent fetches (works during single request lifecycle)
const fetchingTimezones = new Set<number>()

// API key stays on server - never exposed to client
const OPENMETEO_API_KEY = process.env.OPEN_METEO_API_KEY
const API_BASE_URL = OPENMETEO_API_KEY 
  ? 'https://customer-api.open-meteo.com/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast'

// Blob path helper
const getBlobPath = (year: number, tz: number) => `weather/${year}/tz-${tz}.json`

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

interface WeatherData {
  temperature_c: number
  weather_condition: string
  wind_speed_mps: number
  wind_direction_deg: number
  wind_gust_mps?: number
}

interface SantaStop {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  timezone: string
  utc_offset: number
  utc_offset_rounded: number
  utc_time: string
  local_time: string
  population: number
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

function parseCSV(csvContent: string): SantaStop[] {
  const lines = csvContent.split('\n')
  const stops: SantaStop[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Parse CSV line handling quoted fields
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    
    stops.push({
      stop_number: parseInt(values[0]),
      city: values[1],
      country: values[2],
      lat: parseFloat(values[3]),
      lng: parseFloat(values[4]),
      timezone: values[5],
      utc_offset: parseFloat(values[6]),
      utc_offset_rounded: parseInt(values[7]),
      utc_time: values[8],
      local_time: values[9],
      population: parseInt(values[10]),
    })
  }
  
  return stops
}

export async function POST(request: NextRequest) {
  try {
    const { timezone, dataFile, year = 2025 } = await request.json() as {
      timezone: number
      dataFile: string
      year?: number
    }
    
    if (timezone === undefined || timezone === null) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    // Only allow 2025 for live weather fetching
    if (year !== 2025) {
      return NextResponse.json({ error: 'Live weather only available for 2025' }, { status: 400 })
    }
    
    const blobPath = getBlobPath(year, timezone)
    
    // Check if blob already exists
    try {
      const blobInfo = await head(blobPath)
      if (blobInfo) {
        console.log(`⏭️ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already has blob`)
        return NextResponse.json({ 
          success: true, 
          status: 'already_complete',
          blobUrl: blobInfo.url,
          message: `Weather for UTC${timezone >= 0 ? '+' : ''}${timezone} already fetched`
        })
      }
    } catch {
      // Blob doesn't exist, continue to fetch
    }
    
    // In-memory lock to prevent concurrent fetches in same instance
    if (fetchingTimezones.has(timezone)) {
      console.log(`⏳ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already being fetched`)
      await delay(2000)
      // Check again if blob was created
      try {
        const blobInfo = await head(blobPath)
        if (blobInfo) {
          return NextResponse.json({ 
            success: true, 
            status: 'completed_by_other',
            blobUrl: blobInfo.url,
            message: `Weather for UTC${timezone >= 0 ? '+' : ''}${timezone} was fetched by another request`
          })
        }
      } catch {
        // Continue
      }
    }
    
    // Read CSV to get stop locations for this timezone
    const fileName = dataFile?.replace(/^\//, '') || '2025_santa_tracker.csv'
    const csvPath = path.join(process.cwd(), 'public', fileName)
    
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 })
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const allStops = parseCSV(csvContent)
    const tzStops = allStops.filter(s => s.utc_offset_rounded === timezone)
    
    if (tzStops.length === 0) {
      return NextResponse.json({ 
        success: true, 
        status: 'no_stops',
        message: `No stops found for UTC${timezone >= 0 ? '+' : ''}${timezone}`
      })
    }
    
    // Mark as being fetched
    fetchingTimezones.add(timezone)
    console.log(`🌤️ Fetching weather for UTC${timezone >= 0 ? '+' : ''}${timezone} (${tzStops.length} stops)`)
    
    try {
      const locations = tzStops.map(s => ({
        lat: s.lat,
        lng: s.lng,
        stop_number: s.stop_number
      }))
      
      const weatherMap: Record<number, WeatherData> = {}
      
      // Batch size - larger with API key
      const BATCH_SIZE = OPENMETEO_API_KEY ? 50 : 10
      const DELAY_BETWEEN_BATCHES = OPENMETEO_API_KEY ? 100 : 1500
      
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
            weatherMap[loc.stop_number] = {
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
      
      // Save weather to Blob as JSON
      const weatherCount = Object.keys(weatherMap).length
      if (weatherCount > 0) {
        const blob = await put(blobPath, JSON.stringify(weatherMap), {
          access: 'public',
          contentType: 'application/json',
        })
        console.log(`💾 Saved weather to Blob: ${weatherCount} stops for UTC${timezone >= 0 ? '+' : ''}${timezone}`)
        console.log(`   Blob URL: ${blob.url}`)
        
        fetchingTimezones.delete(timezone)
        
        return NextResponse.json({ 
          success: true, 
          status: 'fetched',
          blobUrl: blob.url,
          message: `Weather fetched for UTC${timezone >= 0 ? '+' : ''}${timezone}`,
          stopCount: tzStops.length,
          fetchedCount: weatherCount
        })
      }
      
      fetchingTimezones.delete(timezone)
      
      return NextResponse.json({ 
        success: true, 
        status: 'no_weather',
        message: `No weather data retrieved for UTC${timezone >= 0 ? '+' : ''}${timezone}`,
        stopCount: tzStops.length,
        fetchedCount: 0
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
