import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Server-side weather ensuring endpoint
 * - Checks if weather already exists in CSV for a timezone
 * - Only fetches if missing
 * - Uses server-side locking to prevent concurrent fetches
 */

// Server-side lock to prevent concurrent fetches for the same timezone
const fetchingTimezones = new Set<number>()
const completedTimezones = new Set<number>()

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
  temperature_c: string | number
  weather_condition: string
  wind_speed_mps: string | number
  wind_direction_deg: string | number
  wind_gust_mps: string | number
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
      temperature_c: values[11],
      weather_condition: values[12],
      wind_speed_mps: values[13],
      wind_direction_deg: values[14],
      wind_gust_mps: values[15],
    })
  }
  
  return stops
}

function updateCSVWithWeather(
  csvPath: string, 
  weatherUpdates: Map<number, { temperature_c: number; weather_condition: string; wind_speed_mps: number; wind_direction_deg: number; wind_gust_mps?: number }>
): void {
  const csv = fs.readFileSync(csvPath, 'utf-8')
  const lines = csv.split('\n')
  const outputLines: string[] = [lines[0]] // Keep header
  
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
        current += char
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    
    const stopNumber = parseInt(values[0])
    const weather = weatherUpdates.get(stopNumber)
    
    if (weather) {
      // Update weather columns (indices 11-15)
      values[11] = String(weather.temperature_c)
      values[12] = weather.weather_condition
      values[13] = String(weather.wind_speed_mps)
      values[14] = String(weather.wind_direction_deg)
      values[15] = weather.wind_gust_mps !== undefined ? String(weather.wind_gust_mps) : ''
    }
    
    outputLines.push(values.join(','))
  }
  
  fs.writeFileSync(csvPath, outputLines.join('\n'))
}

export async function POST(request: NextRequest) {
  try {
    const { timezone, dataFile } = await request.json() as {
      timezone: number
      dataFile: string
    }
    
    if (timezone === undefined || timezone === null) {
      return NextResponse.json({ error: 'No timezone provided' }, { status: 400 })
    }
    
    // Only allow updating 2025 file for security
    const allowedFiles = ['2025_santa_tracker.csv']
    const fileName = dataFile?.replace(/^\//, '') || '2025_santa_tracker.csv'
    
    if (!allowedFiles.includes(fileName)) {
      return NextResponse.json({ error: 'Invalid data file' }, { status: 400 })
    }
    
    // If we already completed this timezone, return immediately
    if (completedTimezones.has(timezone)) {
      console.log(`⏭️ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already completed, skipping`)
      return NextResponse.json({ 
        success: true, 
        status: 'already_complete',
        message: `Weather for UTC${timezone >= 0 ? '+' : ''}${timezone} already fetched`
      })
    }
    
    // If another request is already fetching this timezone, wait for it
    if (fetchingTimezones.has(timezone)) {
      console.log(`⏳ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already being fetched, waiting...`)
      
      // Wait up to 30 seconds for the other request to complete
      for (let i = 0; i < 60; i++) {
        await delay(500)
        if (completedTimezones.has(timezone)) {
          return NextResponse.json({ 
            success: true, 
            status: 'completed_by_other',
            message: `Weather for UTC${timezone >= 0 ? '+' : ''}${timezone} was fetched by another request`
          })
        }
        if (!fetchingTimezones.has(timezone)) {
          break // The other request finished (maybe failed)
        }
      }
    }
    
    const csvPath = path.join(process.cwd(), 'public', fileName)
    
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 })
    }
    
    // Read CSV and check if weather data already exists for this timezone
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const stops = parseCSV(csvContent)
    
    const tzStops = stops.filter(s => s.utc_offset_rounded === timezone)
    
    if (tzStops.length === 0) {
      return NextResponse.json({ 
        success: true, 
        status: 'no_stops',
        message: `No stops found for UTC${timezone >= 0 ? '+' : ''}${timezone}`
      })
    }
    
    // Check how many stops already have weather data
    const stopsWithWeather = tzStops.filter(s => 
      s.temperature_c !== '' && s.temperature_c !== undefined
    )
    
    // If most stops already have weather (>90%), consider it complete
    if (stopsWithWeather.length >= tzStops.length * 0.9) {
      completedTimezones.add(timezone)
      console.log(`✅ Timezone UTC${timezone >= 0 ? '+' : ''}${timezone} already has weather data (${stopsWithWeather.length}/${tzStops.length} stops)`)
      return NextResponse.json({ 
        success: true, 
        status: 'already_has_data',
        message: `Weather already exists for UTC${timezone >= 0 ? '+' : ''}${timezone}`,
        stopCount: tzStops.length,
        weatherCount: stopsWithWeather.length
      })
    }
    
    // Mark timezone as being fetched
    fetchingTimezones.add(timezone)
    console.log(`🌤️ Fetching weather for UTC${timezone >= 0 ? '+' : ''}${timezone} (${tzStops.length} stops)`)
    
    try {
      // Get stops that need weather data
      const stopsNeedingWeather = tzStops.filter(s => 
        s.temperature_c === '' || s.temperature_c === undefined
      )
      
      const locations = stopsNeedingWeather.map(s => ({
        lat: s.lat,
        lng: s.lng,
        stop_number: s.stop_number
      }))
      
      const weatherUpdates = new Map<number, {
        temperature_c: number
        weather_condition: string
        wind_speed_mps: number
        wind_direction_deg: number
        wind_gust_mps?: number
      }>()
      
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
            weatherUpdates.set(loc.stop_number, {
              temperature_c: Math.round(weatherData.current.temperature_2m * 10) / 10,
              weather_condition: weatherCodeToCondition(weatherData.current.weather_code),
              wind_speed_mps: Math.round(kmhToMps(weatherData.current.wind_speed_10m) * 100) / 100,
              wind_direction_deg: weatherData.current.wind_direction_10m,
              wind_gust_mps: weatherData.current.wind_gusts_10m 
                ? Math.round(kmhToMps(weatherData.current.wind_gusts_10m) * 100) / 100 
                : undefined,
            })
          }
        })
        
        // Delay between batches
        if (i + BATCH_SIZE < locations.length) {
          await delay(DELAY_BETWEEN_BATCHES)
        }
      }
      
      // Save weather to CSV
      if (weatherUpdates.size > 0) {
        updateCSVWithWeather(csvPath, weatherUpdates)
        console.log(`💾 Saved weather to CSV: ${weatherUpdates.size} stops for UTC${timezone >= 0 ? '+' : ''}${timezone}`)
      }
      
      // Mark as completed
      completedTimezones.add(timezone)
      fetchingTimezones.delete(timezone)
      
      return NextResponse.json({ 
        success: true, 
        status: 'fetched',
        message: `Weather fetched for UTC${timezone >= 0 ? '+' : ''}${timezone}`,
        stopCount: tzStops.length,
        fetchedCount: weatherUpdates.size
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

