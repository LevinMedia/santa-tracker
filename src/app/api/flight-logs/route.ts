import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Cache the response for 1 hour at the edge (CDN) and revalidate in background
export const revalidate = 3600

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const files = fs.readdirSync(publicDir)
    
    // Find files matching the pattern YYYY_santa_tracker_weather.csv
    const flightLogs = files
      .filter(file => /^\d{4}_santa_tracker_weather\.csv$/.test(file))
      .map(file => {
        const year = parseInt(file.substring(0, 4))
        return {
          year,
          filename: file.replace('.csv', ''),
          label: `${year} / Santa Tracker`,
        }
      })
      .sort((a, b) => b.year - a.year) // Sort by year descending (newest first)
    
    // Add cache headers for edge caching
    return NextResponse.json(
      { flightLogs },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('Error scanning flight logs:', error)
    return NextResponse.json({ flightLogs: [] })
  }
}

