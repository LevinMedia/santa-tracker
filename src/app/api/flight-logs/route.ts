import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Cache the response for 1 hour at the edge (CDN) and revalidate in background
export const revalidate = 3600

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const files = fs.readdirSync(publicDir)
    
    // Get current year and determine if we should show it
    // Don't show current year until after Dec 26 UTC (live run is complete)
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const isAfterLiveRun = now.getUTCMonth() === 11 && now.getUTCDate() >= 26 // Dec 26 or later
    
    // Find files matching the pattern YYYY_santa_tracker.csv or YYYY_santa_tracker_weather.csv
    const flightLogs = files
      .filter(file => /^\d{4}_santa_tracker(_weather)?\.csv$/.test(file))
      .map(file => {
        const year = parseInt(file.substring(0, 4))
        // Prefer non-weather version filename for cleaner URLs
        const baseFilename = `${year}_santa_tracker`
        return {
          year,
          filename: baseFilename,
          label: `${year} / Santa Tracker`,
        }
      })
      // Remove duplicates (if both weather and non-weather exist for same year)
      .filter((log, index, self) => 
        index === self.findIndex(l => l.year === log.year)
      )
      // Don't show current year until after live run is complete
      .filter(log => {
        if (log.year === currentYear) {
          return isAfterLiveRun
        }
        return true
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

