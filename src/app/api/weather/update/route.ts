import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

interface WeatherUpdate {
  stop_number: number
  temperature_c: number
  weather_condition: string
  wind_speed_mps: number
  wind_direction_deg: number
  wind_gust_mps?: number
}

export async function POST(request: NextRequest) {
  try {
    const { updates, dataFile } = await request.json() as {
      updates: WeatherUpdate[]
      dataFile: string
    }
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'No weather updates provided' }, { status: 400 })
    }
    
    // Only allow updating specific CSV files for security
    const allowedFiles = ['2025_santa_tracker.csv']
    const fileName = dataFile?.replace(/^\//, '') || '2025_santa_tracker.csv'
    
    if (!allowedFiles.includes(fileName)) {
      return NextResponse.json({ error: 'Invalid data file' }, { status: 400 })
    }
    
    const csvPath = path.join(process.cwd(), 'public', fileName)
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 })
    }
    
    // Read current CSV
    const csv = fs.readFileSync(csvPath, 'utf-8')
    const lines = csv.split('\n')
    
    // Create a map of stop_number to weather data for quick lookup
    const weatherMap = new Map<number, WeatherUpdate>()
    updates.forEach(update => {
      weatherMap.set(update.stop_number, update)
    })
    
    // Update lines with weather data
    // CSV columns: 0-stop_number, 1-city, 2-country, 3-state_province, 4-lat, 5-lng, 6-timezone, 
    //              7-utc_offset, 8-utc_offset_rounded, 9-utc_time, 10-local_time, 11-population
    //              12-temperature_c, 13-weather_condition, 14-wind_speed_mps, 15-wind_direction_deg, 16-wind_gust_mps
    
    let updatedCount = 0
    const outputLines = [lines[0]] // Keep header
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Parse the CSV line (handle quoted fields)
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
      const weather = weatherMap.get(stopNumber)
      
      if (weather) {
        // Update weather columns
        values[12] = weather.temperature_c?.toString() || ''
        values[13] = weather.weather_condition ? `"${weather.weather_condition}"` : ''
        values[14] = weather.wind_speed_mps?.toString() || ''
        values[15] = weather.wind_direction_deg?.toString() || ''
        values[16] = weather.wind_gust_mps?.toString() || ''
        updatedCount++
      }
      
      outputLines.push(values.join(','))
    }
    
    // Write back to CSV
    fs.writeFileSync(csvPath, outputLines.join('\n'))
    
    console.log(`✅ Weather updated for ${updatedCount} stops in ${fileName}`)
    
    return NextResponse.json({ 
      success: true, 
      updatedCount,
      message: `Updated weather for ${updatedCount} stops` 
    })
    
  } catch (error) {
    console.error('Error updating weather in CSV:', error)
    return NextResponse.json(
      { error: 'Failed to update weather data' }, 
      { status: 500 }
    )
  }
}

