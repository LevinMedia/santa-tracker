'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import FlightLogPanel from './FlightLogPanel'

interface FlightStop {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  utc_time: string
  local_time: string
  timestamp: number
  timezone?: string
  utc_offset?: number
  utc_offset_rounded?: number
  population?: number
  // Weather data
  temperature_c?: number
  weather_condition?: string
  wind_speed_mps?: number
  wind_direction_deg?: number
  wind_gust_mps?: number
}

interface GlobeMapProps {
  dataFile?: string
  mode?: 'replay' | 'live'
}

// Parse CSV line handling quoted fields with commas
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

// Parse UTC time string to timestamp
// In replay mode, we force the year to current year so timestamps work for playback
// In live mode, we use the actual year from the data
function parseUTCTime(timeStr: string, useRealYear: boolean = false): number {
  const date = new Date(timeStr.replace(' ', 'T') + 'Z')

  if (!isNaN(date.getTime()) && !useRealYear) {
    // Force current year to align replay data with current time calculations
    date.setUTCFullYear(new Date().getFullYear())
  }

  return date.getTime()
}

// Format elapsed time in hours and minutes
function formatElapsedTime(ms: number): string {
  if (ms <= 0) return '0h 0m'

  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}h ${minutes}m`
}

const SPEED_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 10, label: '10x' },
  { value: 60, label: '60x' },
  { value: 300, label: 'MAX' },
]

// Interpolate position along great circle arc
function interpolateGreatCircle(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  progress: number
): { lat: number; lng: number } {
  // Convert to radians
  const lat1 = start.lat * Math.PI / 180
  const lng1 = start.lng * Math.PI / 180
  const lat2 = end.lat * Math.PI / 180
  const lng2 = end.lng * Math.PI / 180
  
  // Calculate angular distance
  const d = Math.acos(
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  )
  
  if (d < 0.0001) return start
  
  // Spherical interpolation
  const a = Math.sin((1 - progress) * d) / Math.sin(d)
  const b = Math.sin(progress * d) / Math.sin(d)
  
  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
  const z = a * Math.sin(lat1) + b * Math.sin(lat2)
  
  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI,
    lng: Math.atan2(y, x) * 180 / Math.PI
  }
}

// Calculate sun position (subsolar point) based on UTC time
function getSunPosition(timestamp: number): { lat: number; lng: number } {
  const date = new Date(timestamp)
  
  // Calculate solar declination (latitude where sun is directly overhead)
  // Simplified formula - accurate enough for visualization
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180)
  
  // Calculate hour angle (longitude where sun is directly overhead)
  // Based on UTC time - sun is at 0° longitude at 12:00 UTC
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60
  const lng = (12 - hours) * 15 // 15° per hour, noon = 0°
  
  return { lat: declination, lng }
}

export default function GlobeMap({ dataFile = '/2024_santa_tracker_weather.csv', mode = 'replay' }: GlobeMapProps) {
  const [stops, setStops] = useState<FlightStop[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(300)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [displayTime, setDisplayTime] = useState<string>('')
  const [travelProgress, setTravelProgress] = useState(0)
  const [globeReady, setGlobeReady] = useState(false)
  const [GlobeComponent, setGlobeComponent] = useState<any>(null)
  const [currentSimTime, setCurrentSimTime] = useState<number>(0)
  const defaultCameraAltitude = 1.7 // Slightly closer default zoom (~33% closer)
  const [cameraAltitude, setCameraAltitude] = useState<number>(defaultCameraAltitude)
  const [flightLogOpen, setFlightLogOpen] = useState(true)
  
  // Loading state
  const [initialized, setInitialized] = useState(false)
  
  // Live mode state
  const [liveIndex, setLiveIndex] = useState(0)
  const [liveTravelProgress, setLiveTravelProgress] = useState(0)
  const [isFollowingLive, setIsFollowingLive] = useState(mode === 'live')
  const isLive = mode === 'live'
  
  const playStartTime = useRef<number>(0)
  const playStartIndex = useRef<number>(0)
  const playStartSimTime = useRef<number>(0)
  const animationFrame = useRef<number>(0)
  const speedMenuRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  // Mission timing
  const missionStart = stops.length > 0 ? stops[0].timestamp : 0

  // Load Globe component on client
  useEffect(() => {
    import('react-globe.gl').then((mod) => {
      setGlobeComponent(() => mod.default)
    })
  }, [])

  // Track container size for globe resizing
  useEffect(() => {
    if (!containerRef.current) return

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    // Initial size
    updateSize()

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(containerRef.current)

    // Also listen for window resize
    window.addEventListener('resize', updateSize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  // Point globe at North Pole when ready and load data
  useEffect(() => {
    if (globeReady && globeRef.current && !initialized) {
      // Point at North Pole
      globeRef.current.pointOfView({ lat: 90, lng: 0, altitude: defaultCameraAltitude }, 0)
      setInitialized(true)
    }
  }, [globeReady, initialized])

  // Ensure no autorotation while initializing
  useEffect(() => {
    if (!globeReady || !globeRef.current) return

    const controls = globeRef.current.controls?.()
    if (controls) {
      controls.autoRotate = false
      controls.autoRotateSpeed = 0
      controls.update?.()
    }
  }, [globeReady])

  // Load flight data in background
  useEffect(() => {
    setLoading(true)
    // Add cache-busting to ensure fresh data
    fetch(`${dataFile}?t=${Date.now()}`)
      .then(res => res.text())
      .then(csv => {
        const lines = csv.trim().split('\n')
        const data: FlightStop[] = []
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          const lat = parseFloat(values[3])
          const lng = parseFloat(values[4])
          const utc_time = values[8] || ''
          const population = values[10] ? parseInt(values[10], 10) : undefined
          const temperature_c = values[11] ? parseFloat(values[11]) : undefined
          const weather_condition = values[12] || undefined
          const wind_speed_mps = values[13] ? parseFloat(values[13]) : undefined
          const wind_direction_deg = values[14] ? parseFloat(values[14]) : undefined
          const wind_gust_mps = values[15] ? parseFloat(values[15]) : undefined

          if (isNaN(lat) || isNaN(lng)) continue

          data.push({
            stop_number: parseInt(values[0]) || i,
            city: values[1] || 'Unknown',
            country: values[2] || 'Unknown',
            lat,
            lng,
            utc_time,
            local_time: values[9] || '',
            timestamp: parseUTCTime(utc_time, isLive), // Use real year for live mode
            timezone: values[5] || undefined,
            utc_offset: values[6] ? parseFloat(values[6]) : undefined,
            utc_offset_rounded: values[7] ? parseFloat(values[7]) : undefined,
            population,
            temperature_c,
            weather_condition,
            wind_speed_mps,
            wind_direction_deg,
            wind_gust_mps,
          })
        }
        
        setStops(data)
        
        if (isLive) {
          // Live mode: start at beginning, will calculate live position
          setCurrentIndex(0)
        } else {
          // Replay mode: start at end
          setCurrentIndex(Math.max(0, data.length - 1))
        }
        
        setLoading(false)
        console.log(`Loaded ${data.length} flight stops from ${dataFile} (mode: ${mode})`)
      })
      .catch(err => {
        console.error('Error loading flight data:', err)
        setLoading(false)
      })
  }, [dataFile, isLive, mode])

  // Format timestamp to UTC string
  const formatUTCTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toISOString().replace('T', ' ').slice(0, 19)
  }, [])

  // Live mode: Calculate current position based on real UTC time
  useEffect(() => {
    if (!isLive || loading || stops.length === 0) return
    
    const calculateLivePosition = () => {
      const now = Date.now()
      
      // Find the last stop that has already happened
      let newLiveIndex = -1
      for (let i = 0; i < stops.length; i++) {
        if (stops[i].timestamp <= now) {
          newLiveIndex = i
        } else {
          break
        }
      }
      
      // If flight hasn't started yet, stay at index 0
      if (newLiveIndex < 0) {
        newLiveIndex = 0
        setLiveIndex(0)
        setLiveTravelProgress(0)
        if (isFollowingLive) {
          setCurrentIndex(0)
          setTravelProgress(0)
          setCurrentSimTime(stops[0].timestamp)
          setDisplayTime(stops[0].utc_time)
        }
        return
      }
      
      setLiveIndex(newLiveIndex)
      
      // Calculate travel progress toward next stop
      if (newLiveIndex < stops.length - 1) {
        const currentStopTs = stops[newLiveIndex].timestamp
        const nextStopTs = stops[newLiveIndex + 1].timestamp
        const legDuration = nextStopTs - currentStopTs
        const timeIntoLeg = now - currentStopTs
        const progress = Math.max(0, Math.min(1, timeIntoLeg / legDuration))
        setLiveTravelProgress(progress)
        
        if (isFollowingLive) {
          setCurrentIndex(newLiveIndex)
          setTravelProgress(progress)
          setCurrentSimTime(now)
          setDisplayTime(formatUTCTime(now))
        }
      } else {
        // At the end
        setLiveTravelProgress(0)
        if (isFollowingLive) {
          setCurrentIndex(newLiveIndex)
          setTravelProgress(0)
          setCurrentSimTime(now)
          setDisplayTime(formatUTCTime(now))
        }
      }
    }
    
    // Calculate immediately on load
    calculateLivePosition()
    
    // Update every 100ms for smooth animation
    const interval = setInterval(calculateLivePosition, 100)
    
    return () => clearInterval(interval)
  }, [isLive, loading, stops, isFollowingLive, formatUTCTime])

  // Real-time playback
  useEffect(() => {
    if (!isPlaying || loading || stops.length === 0) return
    
    playStartTime.current = Date.now()
    playStartIndex.current = currentIndex
    playStartSimTime.current = stops[currentIndex].timestamp
    
    const animate = () => {
      const elapsed = Date.now() - playStartTime.current
      const scaledElapsed = elapsed * playSpeed
      const targetMissionTime = playStartSimTime.current + scaledElapsed
      
      setDisplayTime(formatUTCTime(targetMissionTime))
      setCurrentSimTime(targetMissionTime)
      
      let newIndex = currentIndex
      for (let i = playStartIndex.current; i < stops.length; i++) {
        if (stops[i].timestamp <= targetMissionTime) {
          newIndex = i
        } else {
          break
        }
      }
      
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex)
      }
      
      // Calculate travel progress
      if (newIndex < stops.length - 1) {
        const currentStopTs = stops[newIndex].timestamp
        const nextStopTs = stops[newIndex + 1].timestamp
        const legDuration = nextStopTs - currentStopTs
        const timeIntoLeg = targetMissionTime - currentStopTs
        const progress = Math.max(0, Math.min(1, timeIntoLeg / legDuration))
        setTravelProgress(progress)
      } else {
        setTravelProgress(0)
      }
      
      if (newIndex >= stops.length - 1) {
        setIsPlaying(false)
        return
      }
      
      animationFrame.current = requestAnimationFrame(animate)
    }
    
    animationFrame.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [isPlaying, loading, stops, playSpeed, formatUTCTime])

  // Update animation when speed changes
  useEffect(() => {
    if (isPlaying && stops.length > 0) {
      playStartTime.current = Date.now()
      playStartIndex.current = currentIndex
      playStartSimTime.current = stops[currentIndex].timestamp
    }
  }, [playSpeed])

  // Update display time when not playing
  useEffect(() => {
    if (!isPlaying && stops.length > 0 && stops[currentIndex]) {
      setDisplayTime(stops[currentIndex].utc_time)
      setTravelProgress(0)
      setCurrentSimTime(stops[currentIndex].timestamp)
    }
  }, [isPlaying, currentIndex, stops])

  // Track the animated edge tip (or current stop when paused)
  // Only update lat/lng - let user control zoom freely
  useEffect(() => {
    if (!globeRef.current || !globeReady || !stops[currentIndex]) return
    
    const currentStop = stops[currentIndex]
    const nextStop = currentIndex < stops.length - 1 ? stops[currentIndex + 1] : null
    
    let targetLat: number
    let targetLng: number
    
    // Determine if we should show animation (playing in replay, or following live)
    const isAnimating = isLive ? isFollowingLive : isPlaying
    const activeProgress = isLive ? (isFollowingLive ? travelProgress : 0) : travelProgress
    
    if (isAnimating && nextStop && activeProgress > 0) {
      // Follow the tip of the animated edge
      const interpolated = interpolateGreatCircle(currentStop, nextStop, activeProgress)
      targetLat = interpolated.lat
      targetLng = interpolated.lng
    } else {
      // When paused/not following, center on current stop
      targetLat = currentStop.lat
      targetLng = currentStop.lng
    }
    
    // Only set lat/lng, preserve user's altitude/zoom
    const currentPov = globeRef.current.pointOfView()
    globeRef.current.pointOfView(
      { lat: targetLat, lng: targetLng, altitude: currentPov?.altitude ?? defaultCameraAltitude },
      isAnimating ? 0 : 300  // No animation during playback/live to avoid zoom fighting
    )
  }, [currentIndex, stops, globeReady, isPlaying, travelProgress, isLive, isFollowingLive])

  // Track altitude changes from user zooming
  const lastAltitudeRef = useRef(cameraAltitude)
  useEffect(() => {
    if (!globeRef.current || !globeReady) return
    
    const checkAltitude = () => {
      const pov = globeRef.current?.pointOfView()
      if (pov?.altitude && Math.abs(pov.altitude - lastAltitudeRef.current) > 0.1) {
        lastAltitudeRef.current = pov.altitude
        setCameraAltitude(pov.altitude)
      }
    }
    
    const interval = setInterval(checkAltitude, 200)
    return () => clearInterval(interval)
  }, [globeReady])

  // Update sun lighting based on simulation time
  useEffect(() => {
    if (!globeRef.current || !globeReady || !currentSimTime) return
    
    const scene = globeRef.current.scene()
    if (!scene) return
    
    // Find or create directional light
    let sunLight = scene.getObjectByName('sunLight')
    if (!sunLight) {
      // Import THREE dynamically
      import('three').then(({ DirectionalLight, AmbientLight }) => {
        // Add ambient light for base illumination
        const ambient = new AmbientLight(0x333333, 0.5)
        ambient.name = 'ambientLight'
        scene.add(ambient)
        
        // Add directional light for sun
        const directional = new DirectionalLight(0xffffee, 1.5)
        directional.name = 'sunLight'
        scene.add(directional)
        
        // Position the sun
        const sunPos = getSunPosition(currentSimTime)
        const sunDistance = 200
        const phi = (90 - sunPos.lat) * Math.PI / 180
        const theta = (sunPos.lng + 180) * Math.PI / 180
        directional.position.set(
          sunDistance * Math.sin(phi) * Math.cos(theta),
          sunDistance * Math.cos(phi),
          sunDistance * Math.sin(phi) * Math.sin(theta)
        )
      })
    } else {
      // Update sun position
      const sunPos = getSunPosition(currentSimTime)
      const sunDistance = 200
      const phi = (90 - sunPos.lat) * Math.PI / 180
      const theta = (sunPos.lng + 180) * Math.PI / 180
      sunLight.position.set(
        sunDistance * Math.sin(phi) * Math.cos(theta),
        sunDistance * Math.cos(phi),
        sunDistance * Math.sin(phi) * Math.sin(theta)
      )
    }
  }, [globeReady, currentSimTime])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value)
    
    if (isLive) {
      // In live mode, can't scrub past liveIndex
      const clampedIndex = Math.min(newIndex, liveIndex)
      setCurrentIndex(clampedIndex)
      
      // If scrubbing away from live position, stop following
      if (clampedIndex < liveIndex) {
        setIsFollowingLive(false)
        setTravelProgress(0)
        if (stops[clampedIndex]) {
          setCurrentSimTime(stops[clampedIndex].timestamp)
          setDisplayTime(stops[clampedIndex].utc_time)
        }
      }
    } else {
      setCurrentIndex(newIndex)
      if (isPlaying && stops.length > 0) {
        playStartTime.current = Date.now()
        playStartIndex.current = newIndex
        playStartSimTime.current = stops[newIndex].timestamp
      }
    }
  }, [isPlaying, stops, isLive, liveIndex])

  // For live mode: determine if we're at the live edge
  const isAtLiveEdge = isLive && currentIndex === liveIndex && isFollowingLive
  
  const isAtEnd = stops.length > 0 && currentIndex >= stops.length - 1

  const togglePlay = useCallback(() => {
    if (isLive) {
      // In live mode, play button doesn't apply at live edge
      // If viewing history, could implement "catch up" animation, but for now just jump to live
      return
    }
    
    if (isAtEnd) {
      // Reset for replay - wipe all points
      setCurrentIndex(0)
      setCurrentSimTime(missionStart)
      setDisplayTime(formatUTCTime(missionStart))
      setIsPlaying(true)
      return
    }
    setIsPlaying(prev => !prev)
  }, [formatUTCTime, isAtEnd, missionStart, isLive])
  
  // Jump to live position
  const jumpToLive = useCallback(() => {
    if (!isLive) return
    setIsFollowingLive(true)
    setCurrentIndex(liveIndex)
    setTravelProgress(liveTravelProgress)
  }, [isLive, liveIndex, liveTravelProgress])

  // Handle selecting a stop from the flight log
  const handleSelectStop = useCallback((index: number) => {
    setCurrentIndex(index)
    setIsPlaying(false)
    if (stops[index]) {
      setCurrentSimTime(stops[index].timestamp)
      setDisplayTime(stops[index].utc_time)
    }
  }, [stops])

  // Close speed menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false)
      }
    }
    if (speedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [speedMenuOpen])

  const currentStop = stops[currentIndex]
  // In live mode, progress is relative to liveIndex (available stops), not total stops
  const progress = isLive 
    ? (liveIndex > 0 ? ((currentIndex + 1) / (liveIndex + 1)) * 100 : 0)
    : (stops.length > 0 ? ((currentIndex + 1) / stops.length) * 100 : 0)

  const elapsedMs = missionStart > 0 && currentSimTime
    ? Math.max(0, currentSimTime - missionStart)
    : 0
  const elapsedDisplay = missionStart > 0 && currentSimTime
    ? formatElapsedTime(elapsedMs)
    : '-- : --'

  // Prepare point data for visited stops
  // Scale current marker size based on zoom level (altitude)
  const currentMarkerSize = Math.max(0.1, Math.min(0.4, 0.4 * (cameraAltitude / 2)))
  
  // Only show visited stops - limit to MAX_POINTS for performance
  const MAX_POINTS = 1000
  const FADE_ZONE = 200 // Points in this range will fade out
  
  const visitedPoints = useMemo(() => {
    const totalVisited = currentIndex + 1
    const startIndex = Math.max(0, totalVisited - MAX_POINTS)
    const visibleStops = stops.slice(startIndex, totalVisited)
    
    return visibleStops.map((stop, idx) => {
      const isCurrentStop = stop.stop_number === currentStop?.stop_number
      
      // Calculate fade for oldest points in the window
      let opacity = 1
      if (totalVisited > MAX_POINTS && idx < FADE_ZONE) {
        opacity = idx / FADE_ZONE // 0 at oldest, 1 at FADE_ZONE
      }
      
      // Convert opacity to color with alpha
      const baseColor = isCurrentStop ? '255, 255, 255' : '51, 255, 51'
      
      return {
        lat: stop.lat,
        lng: stop.lng,
        size: isCurrentStop ? currentMarkerSize : 0.08,
        color: `rgba(${baseColor}, ${opacity})`,
      }
    })
  }, [stops, currentIndex, currentStop, currentMarkerSize])

  
  // Prepare arc data for travel animation (3D arcs through space)
  const nextStop = currentIndex < stops.length - 1 ? stops[currentIndex + 1] : null
  const prevStop = currentIndex > 0 ? stops[currentIndex - 1] : null
  
  // Calculate arc altitude based on distance
  const calcArcAltitude = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const phi1 = lat1 * Math.PI / 180
    const phi2 = lat2 * Math.PI / 180
    const dLambda = (lng2 - lng1) * Math.PI / 180
    
    // Great circle angular distance
    const angularDist = Math.acos(
      Math.max(-1, Math.min(1, // Clamp for numerical stability
        Math.sin(phi1) * Math.sin(phi2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda)
      ))
    )
    
    // Convert to fraction of half-globe (0-1 for 0-180°)
    const distFraction = angularDist / Math.PI
    // Scale altitude: short hops = 0.05, half-globe = 0.6
    return 0.05 + distFraction * 0.55
  }, [])

  const arcsData = useMemo(() => {
    const arcs: Array<{
      startLat: number
      startLng: number
      endLat: number
      endLng: number
      opacity: number
      dashLength: number
      altitude: number
    }> = []
    
    // Determine if we should show animated arcs
    const isAnimating = isLive ? isFollowingLive : isPlaying
    const activeProgress = travelProgress
    
    // Current arc (animating in) - swap start/end so dash draws from current toward next
    if (isAnimating && currentStop && nextStop && activeProgress > 0) {
      arcs.push({
        startLat: nextStop.lat,
        startLng: nextStop.lng,
        endLat: currentStop.lat,
        endLng: currentStop.lng,
        opacity: 1,
        dashLength: activeProgress,
        altitude: calcArcAltitude(currentStop.lat, currentStop.lng, nextStop.lat, nextStop.lng),
      })
    }
    
    // Previous arc (fading out)
    if (isAnimating && currentStop && prevStop && activeProgress > 0 && activeProgress < 1) {
      arcs.push({
        startLat: currentStop.lat,
        startLng: currentStop.lng,
        endLat: prevStop.lat,
        endLng: prevStop.lng,
        opacity: 1 - activeProgress,
        dashLength: 1,
        altitude: calcArcAltitude(prevStop.lat, prevStop.lng, currentStop.lat, currentStop.lng),
      })
    }
    
    return arcs
  }, [isPlaying, currentStop, nextStop, prevStop, travelProgress, calcArcAltitude, isLive, isFollowingLive])

  return (
    <div className="relative w-full h-full bg-black">
      {/* Main content wrapper - shrinks when panel is open (bottom on mobile, right on desktop) */}
      <div 
        className={`
          absolute inset-0 transition-all duration-300 ease-out
          ${flightLogOpen ? 'bottom-[50vh] md:bottom-0 md:right-96' : 'bottom-0 md:right-0'}
        `}
      >
        {/* Flight Log Trigger Button */}
        <button
          onClick={() => setFlightLogOpen(!flightLogOpen)}
          className={`absolute left-4 z-[1000] flex items-center gap-2 border transition-colors text-xs px-2 py-1 font-mono
            ${flightLogOpen 
              ? 'bg-[#33ff33] text-black border-[#33ff33]' 
              : 'bg-black/80 border-[#33ff33]/50 text-[#33ff33]/80 hover:bg-[#33ff33] hover:text-black'
            }`}
          style={{
            textShadow: flightLogOpen ? 'none' : '0 0 5px rgba(51, 255, 51, 0.8)',
            top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)',
          }}
          title="Flight Log"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          FLIGHT LOG
        </button>

        {/* Globe - shifted up to account for bottom HUD */}
        <div ref={containerRef} className="absolute inset-0" style={{ transform: 'translateY(-10%)' }}>
        {GlobeComponent && (
          <GlobeComponent
            ref={globeRef}
            width={containerSize.width}
            height={containerSize.height}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            pointsData={visitedPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointRadius="size"
            pointAltitude={0}
            arcsData={arcsData}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor={(d: any) => `rgba(51, 255, 51, ${d.opacity})`}
            arcStroke={Math.max(0.3, Math.min(1.5, 1.5 * (cameraAltitude / 2)))}
            arcAltitude={(d: any) => d.altitude}
            arcDashLength={(d: any) => d.dashLength}
            arcDashGap={2}
            arcDashAnimateTime={0}
            atmosphereColor="#33ff33"
            atmosphereAltitude={0.15}
            animateIn={false}
            onGlobeReady={() => setGlobeReady(true)}
          />
        )}
      </div>
      
      {/* Scrubber Control Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] font-mono px-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8"
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.4)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        {currentStop && !flightLogOpen && (
          <div className="pb-3 text-center text-[#33ff33]">
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#33ff33]/60">
              Last verified location
            </div>
            <div className="text-sm md:text-base font-semibold uppercase">
              {currentStop.city}, {currentStop.country}
            </div>
          </div>
        )}

        <div className="text-[#33ff33]/60 text-xs border-t border-[#33ff33]/40" />

        <div className="py-2 flex flex-wrap items-center justify-between gap-3 text-[#33ff33] text-xs">
          <div className="flex items-center gap-2">
            {isLive && isAtLiveEdge && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white text-[10px] uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                LIVE
              </span>
            )}
            {isLive && !isFollowingLive && (
              <span className="px-2 py-0.5 bg-[#33ff33]/20 text-[#33ff33] text-[10px] uppercase tracking-wider">
                VIEWING HISTORY
              </span>
            )}
            <span className="text-[#33ff33]/50">STOP:</span>
            <span>{(currentIndex + 1).toLocaleString()}</span>
            <span className="text-[#33ff33]/50">/</span>
            <span>{isLive ? (liveIndex + 1).toLocaleString() : stops.length.toLocaleString()}</span>
          </div>
          {displayTime && (
            <div className="flex items-center gap-2">
              <span className="text-[#33ff33]/50">UTC:</span>
              <span>{displayTime}</span>
            </div>
          )}
        </div>
        
        <div className="border-t border-[#33ff33]/30" />
        
        <div className="py-2 flex items-center gap-4">
          {/* Play/Pause button - hidden in live mode when at live edge */}
          {isLive ? (
            !isFollowingLive ? (
              <button
                onClick={jumpToLive}
                className="px-3 py-1 text-black bg-red-600 hover:bg-red-500 transition-colors text-xs border border-red-600 animate-pulse"
              >
                GO LIVE ⚡
              </button>
            ) : (
              <div className="px-3 py-1 text-[#33ff33]/50 text-xs border border-[#33ff33]/30">
                TRACKING
              </div>
            )
          ) : (
            <button
              onClick={togglePlay}
              className="px-3 py-1 text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors text-xs border border-[#33ff33]/50"
            >
              {isPlaying ? '[ ▌▌ ]' : isAtEnd ? 'REPLAY' : '[ ▶ ]'}
            </button>
          )}
          
          <div className="flex-1 relative h-4 flex items-center">
            <div className="absolute inset-x-0 h-1 bg-[#33ff33]/20" />
            <div 
              className="absolute h-1 bg-[#33ff33]/60 transition-all"
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-x-0 flex justify-between pointer-events-none">
              {[...Array(21)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-px h-2 ${i % 5 === 0 ? 'bg-[#33ff33]/60' : 'bg-[#33ff33]/20'}`}
                />
              ))}
            </div>
            <input
              type="range"
              min="0"
              max={isLive ? Math.max(0, liveIndex) : Math.max(0, stops.length - 1)}
              value={currentIndex}
              onChange={handleScrub}
              className="relative w-full h-4 appearance-none bg-transparent cursor-pointer z-10
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-[#33ff33]
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(51,255,51,0.8)]
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:bg-[#33ff33]
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
          
          {/* Speed selector - only in replay mode */}
          {!isLive && (
            <div className="flex items-center gap-2" ref={speedMenuRef}>
              <span className="text-[#33ff33]/50 text-xs">SPD:</span>
              <div className="relative">
                <button
                  onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                  className="bg-black border border-[#33ff33]/50 text-[#33ff33] text-xs px-3 py-1 cursor-pointer hover:bg-[#33ff33]/10 focus:outline-none focus:border-[#33ff33] flex items-center gap-3"
                  style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.8)' }}
                >
                  <span>{SPEED_OPTIONS.find(o => o.value === playSpeed)?.label || 'MAX'}</span>
                  <svg 
                    className={`w-3 h-3 text-[#33ff33]/60 transition-transform ${speedMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {speedMenuOpen && (
                  <div 
                    className="absolute bottom-full left-0 mb-1 bg-black border border-[#33ff33]/50 min-w-full"
                    style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.8)' }}
                  >
                    {SPEED_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPlaySpeed(option.value)
                          setSpeedMenuOpen(false)
                        }}
                        className={`w-full text-left px-3 py-1 text-xs cursor-pointer transition-colors ${
                          playSpeed === option.value 
                            ? 'bg-[#33ff33] text-black' 
                            : 'text-[#33ff33] hover:bg-[#33ff33]/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t border-[#33ff33]/30" />
        
        <div className="py-2 flex justify-between text-[#33ff33]/50 text-xs">
          <span>PROGRESS: {progress.toFixed(1)}%</span>
          <span>Elapsed: {elapsedDisplay}</span>
        </div>
      </div>
      </div>

      {/* Flight Log Panel - outside content wrapper so it doesn't get pushed */}
      <FlightLogPanel
        key={flightLogOpen ? 'log-open' : 'log-closed'}
        isOpen={flightLogOpen}
        onClose={() => setFlightLogOpen(false)}
        stops={stops}
        currentIndex={currentIndex}
        onSelectStop={handleSelectStop}
        isReplaying={isLive ? isFollowingLive : isPlaying}
        isLive={isLive}
        liveIndex={liveIndex}
      />
    </div>
  )
}

