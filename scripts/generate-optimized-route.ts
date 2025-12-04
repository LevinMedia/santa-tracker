/**
 * Santa Route Optimizer - Traveling Salesman Approach
 * 
 * This script generates an optimized route for Santa using:
 * 1. Timezone-based progression (UTC+14 → UTC-12, following midnight)
 * 2. Serpentine pattern (north→south, then south→north, alternating)
 * 3. TSP optimization within each timezone for shortest travel distance
 * 4. Random perturbation for nearby cities (~15 mile clusters)
 * 5. Per-timezone variable speed (Santa must arrive at each timezone at midnight local)
 */

import * as fs from 'fs'
import * as path from 'path'

// Types
interface City {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  timezone: string
  utc_offset: number
  utc_offset_rounded: number
  population?: number
  temperature_c?: number
  weather_condition?: string
  wind_speed_mps?: number
  wind_direction_deg?: number
  wind_gust_mps?: number
}

interface RouteStop extends City {
  new_stop_number: number
  utc_time: string
  local_time: string
}

interface TimezoneGroup {
  utc_offset: number
  cities: City[]
  optimizedRoute: City[]
  totalDistanceKm: number
  distanceToNextTzKm: number
  speedKmh: number
}

// Constants
const EARTH_RADIUS_KM = 6371
const CLUSTER_RADIUS_KM = 24 // ~15 miles
const ONE_HOUR_MS = 60 * 60 * 1000

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// Calculate distance between two points using Haversine formula
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180
  
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return EARTH_RADIUS_KM * c
}

// Calculate total route distance
function calculateRouteDistance(cities: City[]): number {
  let total = 0
  for (let i = 0; i < cities.length - 1; i++) {
    total += haversineDistance(
      cities[i].lat, cities[i].lng,
      cities[i + 1].lat, cities[i + 1].lng
    )
  }
  return total
}

// Shuffle array randomly
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Find nearest unvisited city
function findNearest(current: City, unvisited: City[]): number {
  let minDist = Infinity
  let nearestIdx = 0
  
  for (let i = 0; i < unvisited.length; i++) {
    const dist = haversineDistance(
      current.lat, current.lng,
      unvisited[i].lat, unvisited[i].lng
    )
    if (dist < minDist) {
      minDist = dist
      nearestIdx = i
    }
  }
  
  return nearestIdx
}

// Nearest neighbor algorithm for TSP
function nearestNeighborTSP(cities: City[], startIdx: number, endIdx: number): City[] {
  if (cities.length <= 2) return cities
  
  const start = cities[startIdx]
  const end = cities[endIdx]
  const middle = cities.filter((_, i) => i !== startIdx && i !== endIdx)
  
  if (middle.length === 0) return [start, end]
  
  // Build route using nearest neighbor
  const route: City[] = [start]
  let remaining = [...middle]
  let current = start
  
  while (remaining.length > 0) {
    const nearestIdx = findNearest(current, remaining)
    current = remaining[nearestIdx]
    route.push(current)
    remaining.splice(nearestIdx, 1)
  }
  
  route.push(end)
  return route
}

// 2-opt improvement for TSP
function twoOptImprove(route: City[], maxIterations: number = 1000): City[] {
  if (route.length <= 3) return route
  
  let improved = true
  let iterations = 0
  let bestRoute = [...route]
  
  while (improved && iterations < maxIterations) {
    improved = false
    iterations++
    
    // Don't swap first and last (they're fixed entry/exit points)
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        // Calculate current distance for this segment
        const d1 = haversineDistance(
          bestRoute[i - 1].lat, bestRoute[i - 1].lng,
          bestRoute[i].lat, bestRoute[i].lng
        )
        const d2 = haversineDistance(
          bestRoute[j].lat, bestRoute[j].lng,
          bestRoute[j + 1].lat, bestRoute[j + 1].lng
        )
        
        // Calculate new distance if we reverse the segment
        const d3 = haversineDistance(
          bestRoute[i - 1].lat, bestRoute[i - 1].lng,
          bestRoute[j].lat, bestRoute[j].lng
        )
        const d4 = haversineDistance(
          bestRoute[i].lat, bestRoute[i].lng,
          bestRoute[j + 1].lat, bestRoute[j + 1].lng
        )
        
        // If improvement, reverse the segment
        if (d3 + d4 < d1 + d2) {
          const newRoute = [...bestRoute]
          // Reverse segment from i to j
          const segment = newRoute.slice(i, j + 1).reverse()
          newRoute.splice(i, j - i + 1, ...segment)
          bestRoute = newRoute
          improved = true
        }
      }
    }
  }
  
  return bestRoute
}

// Apply random perturbation to nearby cities (clusters)
function perturbClusters(route: City[]): City[] {
  if (route.length <= 2) return route
  
  const result: City[] = [route[0]] // Keep first fixed
  let i = 1
  
  while (i < route.length - 1) {
    // Find cluster of nearby cities
    const cluster: City[] = [route[i]]
    let j = i + 1
    
    while (j < route.length - 1) {
      // Check if city j is within cluster radius of any city in cluster
      let isNearby = false
      for (const clusterCity of cluster) {
        const dist = haversineDistance(
          clusterCity.lat, clusterCity.lng,
          route[j].lat, route[j].lng
        )
        if (dist <= CLUSTER_RADIUS_KM) {
          isNearby = true
          break
        }
      }
      
      if (isNearby) {
        cluster.push(route[j])
        j++
      } else {
        break
      }
    }
    
    // Shuffle the cluster randomly
    if (cluster.length > 1) {
      const shuffled = shuffle(cluster)
      result.push(...shuffled)
    } else {
      result.push(cluster[0])
    }
    
    i = j
  }
  
  result.push(route[route.length - 1]) // Keep last fixed
  return result
}

// Optimize route within a timezone
function optimizeTimezoneRoute(cities: City[], goingNorth: boolean): City[] {
  if (cities.length === 0) return []
  if (cities.length === 1) return cities
  
  // Sort by latitude to find entry/exit points
  const sortedByLat = [...cities].sort((a, b) => b.lat - a.lat) // North to south
  
  const northernmost = sortedByLat[0]
  const southernmost = sortedByLat[sortedByLat.length - 1]
  
  // Determine entry and exit based on direction
  const entry = goingNorth ? southernmost : northernmost
  const exit = goingNorth ? northernmost : southernmost
  
  // Find indices
  const entryIdx = cities.findIndex(c => c === entry)
  const exitIdx = cities.findIndex(c => c === exit)
  
  // Apply nearest neighbor TSP
  let route = nearestNeighborTSP(cities, entryIdx, exitIdx)
  
  // Apply 2-opt improvement
  route = twoOptImprove(route)
  
  // Apply random perturbation to clusters
  route = perturbClusters(route)
  
  return route
}

// Format date to string
function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

// Main function
async function main() {
  const inputFile = path.join(__dirname, '../public/2025_santa_tracker.csv')
  const outputFile = path.join(__dirname, '../public/2025_santa_tracker.csv')
  
  console.log('🎅 Santa Route Optimizer')
  console.log('========================\n')
  
  // Read input file
  console.log('📖 Reading source data...')
  const csv = fs.readFileSync(inputFile, 'utf-8')
  const lines = csv.trim().split('\n')
  
  // Parse cities
  const cities: City[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    
    const lat = parseFloat(values[3])
    const lng = parseFloat(values[4])
    
    if (isNaN(lat) || isNaN(lng)) continue
    
    // Skip the North Pole - we'll add it separately
    if (values[1] === 'North Pole') continue
    
    cities.push({
      stop_number: parseInt(values[0]) || i,
      city: values[1] || 'Unknown',
      country: values[2] || 'Unknown',
      lat,
      lng,
      timezone: values[5] || '',
      utc_offset: parseFloat(values[6]) || 0,
      utc_offset_rounded: parseFloat(values[7]) || 0,
      population: values[10] ? parseInt(values[10], 10) : undefined,
      temperature_c: values[11] ? parseFloat(values[11]) : undefined,
      weather_condition: values[12] || undefined,
      wind_speed_mps: values[13] ? parseFloat(values[13]) : undefined,
      wind_direction_deg: values[14] ? parseFloat(values[14]) : undefined,
      wind_gust_mps: values[15] ? parseFloat(values[15]) : undefined,
    })
  }
  
  console.log(`   Found ${cities.length} cities (excluding North Pole)\n`)
  
  // Group by timezone
  console.log('🌍 Grouping cities by timezone...')
  const timezoneMap = new Map<number, City[]>()
  
  for (const city of cities) {
    const tz = city.utc_offset_rounded
    if (!timezoneMap.has(tz)) {
      timezoneMap.set(tz, [])
    }
    timezoneMap.get(tz)!.push(city)
  }
  
  // Sort timezones from UTC+14 down to UTC-12
  const sortedTimezones = Array.from(timezoneMap.keys()).sort((a, b) => b - a)
  console.log(`   Found ${sortedTimezones.length} timezone groups`)
  console.log(`   Order: ${sortedTimezones.join(' → ')}\n`)
  
  // Add North Pole as the starting point
  const northPole: City = {
    stop_number: 0,
    city: 'North Pole',
    country: 'Arctic',
    lat: 90,
    lng: 0,
    timezone: 'UTC+14',
    utc_offset: 14,
    utc_offset_rounded: 14,
    population: 0,
  }
  
  // Build optimized routes for each timezone
  console.log('🚀 Optimizing routes per timezone...')
  const timezoneGroups: TimezoneGroup[] = []
  
  let goingNorth = false // First timezone goes south (after North Pole)
  
  for (const tz of sortedTimezones) {
    const tzCities = timezoneMap.get(tz)!
    const direction = goingNorth ? 'north' : 'south'
    console.log(`   UTC${tz >= 0 ? '+' : ''}${tz}: ${tzCities.length} cities (going ${direction})...`)
    
    const optimizedRoute = optimizeTimezoneRoute(tzCities, goingNorth)
    const totalDistanceKm = calculateRouteDistance(optimizedRoute)
    
    timezoneGroups.push({
      utc_offset: tz,
      cities: tzCities,
      optimizedRoute,
      totalDistanceKm,
      distanceToNextTzKm: 0, // Will calculate next
      speedKmh: 0, // Will calculate next
    })
    
    goingNorth = !goingNorth
  }
  
  // Calculate all distances and speeds
  console.log('\n⏱️  Calculating distances and speeds (Santa has 1 hour per timezone)...\n')
  
  // Distance from North Pole to first stop of first timezone
  const firstTzFirstStop = timezoneGroups[0].optimizedRoute[0]
  const northPoleToFirstStop = haversineDistance(
    northPole.lat, northPole.lng,
    firstTzFirstStop.lat, firstTzFirstStop.lng
  )
  
  for (let i = 0; i < timezoneGroups.length; i++) {
    const group = timezoneGroups[i]
    const firstStop = group.optimizedRoute[0]
    const lastStop = group.optimizedRoute[group.optimizedRoute.length - 1]
    
    // Distance FROM previous location to this timezone's first stop
    let distanceFromPrevKm = 0
    if (i === 0) {
      // First timezone: distance from North Pole
      distanceFromPrevKm = northPoleToFirstStop
    }
    // For other timezones, the "from previous" distance was already counted in the previous timezone's "to next"
    
    if (i < timezoneGroups.length - 1) {
      // Distance to next timezone's first stop
      const nextFirstStop = timezoneGroups[i + 1].optimizedRoute[0]
      group.distanceToNextTzKm = haversineDistance(
        lastStop.lat, lastStop.lng,
        nextFirstStop.lat, nextFirstStop.lng
      )
    } else {
      // Last timezone - no next timezone
      group.distanceToNextTzKm = 0
    }
    
    // Total distance Santa must cover in 1 hour for this timezone:
    // = (distance from previous/North Pole) + internal route + (distance to next timezone)
    const totalDistanceForTz = distanceFromPrevKm + group.totalDistanceKm + group.distanceToNextTzKm
    
    // Speed = distance / 1 hour
    group.speedKmh = totalDistanceForTz // km per hour
    
    // Build detailed breakdown string
    const parts: string[] = []
    if (i === 0) {
      parts.push(`${northPoleToFirstStop.toFixed(0)} km from North Pole`)
    }
    parts.push(`${group.totalDistanceKm.toFixed(0)} km visiting ${group.cities.length} cities`)
    if (group.distanceToNextTzKm > 0) {
      parts.push(`${group.distanceToNextTzKm.toFixed(0)} km to next timezone`)
    }
    
    console.log(`   UTC${group.utc_offset >= 0 ? '+' : ''}${group.utc_offset}:`)
    console.log(`      ${parts.join(' + ')}`)
    console.log(`      = ${totalDistanceForTz.toFixed(0)} km total → Speed: ${group.speedKmh.toFixed(0)} km/h`)
    console.log('')
  }
  
  // Generate timestamps
  console.log('\n⏰ Generating timestamps...')
  const fullRoute: RouteStop[] = []
  let stopNumber = 1
  
  // Use current date to make flight "live" now
  // Calculate the date so that "now" is roughly in the middle of the flight
  const now = new Date()
  
  // Flight takes ~27 hours. To be "live" now, start the flight ~12 hours ago
  // First stop in UTC+14 arrives at midnight local = 10:00 UTC that day
  // So we want firstTzMidnightUTC to be about 12 hours before now
  const hoursIntoFlight = 12 // Put us roughly in the middle
  const firstTzMidnightUTC = new Date(now.getTime() - hoursIntoFlight * ONE_HOUR_MS)
  
  // Round to the nearest hour for cleaner timestamps
  firstTzMidnightUTC.setMinutes(0, 0, 0)
  
  // Calculate what "year" and "day" this corresponds to for the local time calculations
  const year = firstTzMidnightUTC.getUTCFullYear()
  const month = firstTzMidnightUTC.getUTCMonth()
  const day = firstTzMidnightUTC.getUTCDate()
  const startHour = firstTzMidnightUTC.getUTCHours()
  
  console.log(`   Flight window: Starting ${firstTzMidnightUTC.toISOString()} (${hoursIntoFlight}h ago)`)
  
  // Calculate North Pole departure time:
  // Santa needs to travel from North Pole to first stop BEFORE midnight UTC+14
  // Use the first timezone's speed for this leg
  const firstTzSpeed = timezoneGroups[0].speedKmh
  const travelTimeToFirstStopMs = (northPoleToFirstStop / firstTzSpeed) * ONE_HOUR_MS
  const northPoleDepartureUTC = new Date(firstTzMidnightUTC.getTime() - travelTimeToFirstStopMs)
  
  console.log(`   North Pole departure: ${formatDateTime(northPoleDepartureUTC)} UTC`)
  console.log(`   Travel time to first stop: ${(travelTimeToFirstStopMs / 60000).toFixed(1)} minutes`)
  
  // Add North Pole as departure point
  const northPoleLocalTime = new Date(northPoleDepartureUTC.getTime() + 14 * ONE_HOUR_MS)
  fullRoute.push({
    ...northPole,
    new_stop_number: stopNumber++,
    utc_time: formatDateTime(northPoleDepartureUTC),
    local_time: formatDateTime(northPoleLocalTime),
  })
  
  // Process each timezone
  for (let tzIdx = 0; tzIdx < timezoneGroups.length; tzIdx++) {
    const group = timezoneGroups[tzIdx]
    const route = group.optimizedRoute
    
    // Midnight local time for this timezone
    // Each timezone starts 1 hour after the previous one
    // UTC+14 starts at firstTzMidnightUTC, UTC+13 starts 1 hour later, etc.
    const hoursAfterStart = 14 - group.utc_offset
    const midnightUTC = new Date(firstTzMidnightUTC.getTime() + hoursAfterStart * ONE_HOUR_MS)
    
    // If UTC offset is negative, we're into Dec 25 UTC
    // e.g., UTC-5 midnight local = Dec 25 05:00 UTC
    
    let currentTimeMs = midnightUTC.getTime()
    let previousStop: City | null = null
    
    for (let i = 0; i < route.length; i++) {
      const city = route[i]
      
      if (i === 0) {
        // First stop in timezone is exactly at midnight local
        currentTimeMs = midnightUTC.getTime()
      } else {
        // Calculate time based on distance from previous stop and timezone speed
        const distanceFromPrev = haversineDistance(
          previousStop!.lat, previousStop!.lng,
          city.lat, city.lng
        )
        const travelTimeMs = (distanceFromPrev / group.speedKmh) * ONE_HOUR_MS
        currentTimeMs += travelTimeMs
      }
      
      const utcTime = new Date(currentTimeMs)
      const localTime = new Date(currentTimeMs + group.utc_offset * ONE_HOUR_MS)
      
      fullRoute.push({
        ...city,
        new_stop_number: stopNumber++,
        utc_time: formatDateTime(utcTime),
        local_time: formatDateTime(localTime),
      })
      
      previousStop = city
    }
  }
  
  // Calculate return to North Pole
  const lastStop = fullRoute[fullRoute.length - 1]
  const lastTz = timezoneGroups[timezoneGroups.length - 1]
  const distanceToNorthPole = haversineDistance(
    parseFloat(String(lastStop.lat)), parseFloat(String(lastStop.lng)),
    northPole.lat, northPole.lng
  )
  
  // Use a reasonable return speed (average of first and last timezone speeds)
  const returnSpeed = (timezoneGroups[0].speedKmh + lastTz.speedKmh) / 2 || 50000 // fallback
  const returnTravelTimeMs = (distanceToNorthPole / returnSpeed) * ONE_HOUR_MS
  
  const lastStopTimeMs = new Date(lastStop.utc_time + 'Z').getTime()
  const northPoleReturnUTC = new Date(lastStopTimeMs + returnTravelTimeMs)
  const northPoleReturnLocalTime = new Date(northPoleReturnUTC.getTime() + 14 * ONE_HOUR_MS)
  
  console.log(`   Return distance from ${lastStop.city}: ${distanceToNorthPole.toFixed(0)} km`)
  console.log(`   Return travel time: ${(returnTravelTimeMs / 60000).toFixed(1)} minutes`)
  console.log(`   North Pole return: ${formatDateTime(northPoleReturnUTC)} UTC`)
  
  // Add North Pole return as final stop
  fullRoute.push({
    ...northPole,
    new_stop_number: stopNumber++,
    utc_time: formatDateTime(northPoleReturnUTC),
    local_time: formatDateTime(northPoleReturnLocalTime),
  })
  
  console.log(`   Generated ${fullRoute.length} stops with timestamps`)
  
  // Calculate total distance
  const totalDistance = calculateRouteDistance(fullRoute as City[])
  console.log(`\n📊 Route Statistics:`)
  console.log(`   Total stops: ${fullRoute.length}`)
  console.log(`   Total distance: ${totalDistance.toFixed(0)} km (${(totalDistance * 0.621371).toFixed(0)} miles)`)
  
  // Calculate time span
  const firstTime = new Date(fullRoute[0].utc_time + 'Z')
  const lastTime = new Date(fullRoute[fullRoute.length - 1].utc_time + 'Z')
  const totalHours = (lastTime.getTime() - firstTime.getTime()) / ONE_HOUR_MS
  console.log(`   Time span: ${totalHours.toFixed(1)} hours`)
  console.log(`   Average speed: ${(totalDistance / totalHours).toFixed(0)} km/h`)
  
  // Write output CSV
  console.log('\n💾 Writing optimized route...')
  const outputHeader = 'stop_number,city,country,lat,lng,timezone,utc_offset,utc_offset_rounded,utc_time,local_time,population,temperature_c,weather_condition,wind_speed_mps,wind_direction_deg,wind_gust_mps'
  
  const outputLines = [outputHeader]
  for (const stop of fullRoute) {
    const line = [
      stop.new_stop_number,
      `"${stop.city}"`,
      `"${stop.country}"`,
      stop.lat,
      stop.lng,
      stop.timezone,
      stop.utc_offset,
      stop.utc_offset_rounded,
      stop.utc_time,
      stop.local_time,
      stop.population ?? '',
      '', // temperature_c - will be filled by live weather
      '', // weather_condition - will be filled by live weather
      '', // wind_speed_mps - will be filled by live weather
      '', // wind_direction_deg - will be filled by live weather
      '', // wind_gust_mps - will be filled by live weather
    ].join(',')
    outputLines.push(line)
  }
  
  fs.writeFileSync(outputFile, outputLines.join('\n'))
  console.log(`   Written to: ${outputFile}\n`)
  
  console.log('✅ Done!')
  console.log('   Run again for a different random route variation (perturbClusters shuffles nearby cities).')
}

main().catch(console.error)
