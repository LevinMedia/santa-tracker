import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const files = fs.readdirSync(publicDir)
    
    // Find files matching the pattern YYYY_santa_tracker.csv
    const flightLogs = files
      .filter(file => /^\d{4}_santa_tracker\.csv$/.test(file))
      .map(file => {
        const year = parseInt(file.substring(0, 4))
        return {
          year,
          filename: file.replace('.csv', ''),
          label: `${year} / Santa Tracker`,
        }
      })
      .sort((a, b) => b.year - a.year) // Sort by year descending (newest first)
    
    return NextResponse.json({ flightLogs })
  } catch (error) {
    console.error('Error scanning flight logs:', error)
    return NextResponse.json({ flightLogs: [] })
  }
}

