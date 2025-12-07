import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { FLIGHT_START, FLIGHT_END } from '@/lib/flight-window'

/**
 * Cron endpoint to pre-fetch weather for upcoming timezones
 * Runs at 45 minutes past each hour during Santa's flight
 * 
 * Schedule: 45 * * * * (every hour at :45)
 */

interface SantaStop {
  stop_number: number
  utc_offset_rounded: number
  utc_time: string
  timestamp: number
}

function parseCSV(csvContent: string): SantaStop[] {
  const lines = csvContent.split('\n')
  const stops: SantaStop[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
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
    
    // CSV columns: 0-stop_number, 1-city, 2-country, 3-state_province, 4-lat, 5-lng, 6-timezone,
    //              7-utc_offset, 8-utc_offset_rounded, 9-utc_time, 10-local_time, 11-population
    const utcTime = values[9]
    const timestamp = new Date(utcTime.replace(' ', 'T') + 'Z').getTime()
    
    stops.push({
      stop_number: parseInt(values[0]),
      utc_offset_rounded: parseInt(values[8]),
      utc_time: utcTime,
      timestamp,
    })
  }
  
  return stops
}

function getCurrentTimezone(stops: SantaStop[], now: number): number | null {
  // Find the stop Santa is currently at or approaching
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].timestamp > now) {
      // Santa is traveling to this stop, so he's in the previous stop's timezone
      // or this stop's timezone if it's the first
      const currentStop = i > 0 ? stops[i - 1] : stops[i]
      return currentStop.utc_offset_rounded
    }
  }
  
  // Santa has finished (past all stops)
  return null
}

function getNextTimezone(stops: SantaStop[], currentTz: number): number | null {
  // Find the next different timezone
  let foundCurrent = false
  for (const stop of stops) {
    if (stop.utc_offset_rounded === currentTz) {
      foundCurrent = true
    } else if (foundCurrent) {
      return stop.utc_offset_rounded
    }
  }
  return null
}

export async function GET() {
  const now = Date.now()
  
  // Check if we're within the flight window
  if (now < FLIGHT_START) {
    console.log('🎅 Cron: Flight hasn\'t started yet')
    return NextResponse.json({ 
      success: true, 
      status: 'not_started',
      message: 'Flight hasn\'t started yet',
      flightStart: new Date(FLIGHT_START).toISOString()
    })
  }
  
  if (now > FLIGHT_END) {
    console.log('🎅 Cron: Flight is complete')
    return NextResponse.json({ 
      success: true, 
      status: 'complete',
      message: 'Flight is complete, no more weather to fetch'
    })
  }
  
  // Load flight data
  const csvPath = path.join(process.cwd(), 'public', '2025_santa_tracker.csv')
  
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ error: 'Flight data not found' }, { status: 404 })
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const stops = parseCSV(csvContent)
  
  // Find current timezone
  const currentTz = getCurrentTimezone(stops, now)
  
  if (currentTz === null) {
    console.log('🎅 Cron: Santa has finished his journey')
    return NextResponse.json({ 
      success: true, 
      status: 'journey_complete',
      message: 'Santa has finished his journey'
    })
  }
  
  const nextTz = getNextTimezone(stops, currentTz)
  
  console.log(`🎅 Cron: Santa is in UTC${currentTz >= 0 ? '+' : ''}${currentTz}, next is UTC${nextTz !== null ? (nextTz >= 0 ? '+' : '') + nextTz : 'none'}`)
  
  // Ensure weather for current and next timezone
  const results: Array<{ timezone: number; status: string }> = []
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'
  
  // Ensure current timezone
  try {
    const response = await fetch(`${baseUrl}/api/weather/ensure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: currentTz })
    })
    const data = await response.json()
    results.push({ timezone: currentTz, status: data.status || 'error' })
  } catch (error) {
    console.error(`Error ensuring weather for UTC${currentTz}:`, error)
    results.push({ timezone: currentTz, status: 'error' })
  }
  
  // Ensure next timezone if available
  if (nextTz !== null) {
    try {
      const response = await fetch(`${baseUrl}/api/weather/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: nextTz })
      })
      const data = await response.json()
      results.push({ timezone: nextTz, status: data.status || 'error' })
    } catch (error) {
      console.error(`Error ensuring weather for UTC${nextTz}:`, error)
      results.push({ timezone: nextTz, status: 'error' })
    }
  }
  
  return NextResponse.json({ 
    success: true,
    status: 'processed',
    currentTimezone: currentTz,
    nextTimezone: nextTz,
    results,
    timestamp: new Date(now).toISOString()
  })
}

