'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'

interface FlightStop {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  utc_time: string
  local_time: string
  timestamp: number
}

interface GlobeMapProps {
  dataFile?: string
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
function parseUTCTime(timeStr: string): number {
  const date = new Date(timeStr.replace(' ', 'T') + 'Z')
  return date.getTime()
}

// Format duration in human readable
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
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

export default function GlobeMap({ dataFile = '/test-flight-1.csv' }: GlobeMapProps) {
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
  const [cameraAltitude, setCameraAltitude] = useState<number>(2)
  
  // Loading state
  const [initialized, setInitialized] = useState(false)
  
  const playStartTime = useRef<number>(0)
  const playStartIndex = useRef<number>(0)
  const playStartSimTime = useRef<number>(0)
  const animationFrame = useRef<number>(0)
  const speedMenuRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)

  // Mission timing
  const missionStart = stops.length > 0 ? stops[0].timestamp : 0
  const missionEnd = stops.length > 0 ? stops[stops.length - 1].timestamp : 0
  
  const currentStopTime = stops[currentIndex]?.timestamp || missionStart
  const remainingMissionTime = missionEnd - currentStopTime
  const remainingPlaybackTime = remainingMissionTime / playSpeed

  // Load Globe component on client
  useEffect(() => {
    import('react-globe.gl').then((mod) => {
      setGlobeComponent(() => mod.default)
    })
  }, [])

  // Point globe at North Pole when ready and load data
  useEffect(() => {
    if (globeReady && globeRef.current && !initialized) {
      // Point at North Pole
      globeRef.current.pointOfView({ lat: 90, lng: 0, altitude: 2.5 }, 0)
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
    fetch(dataFile)
      .then(res => res.text())
      .then(csv => {
        const lines = csv.trim().split('\n')
        const data: FlightStop[] = []
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          const lat = parseFloat(values[3])
          const lng = parseFloat(values[4])
          const utc_time = values[8] || ''
          
          if (isNaN(lat) || isNaN(lng)) continue
          
          data.push({
            stop_number: parseInt(values[0]) || i,
            city: values[1] || 'Unknown',
            country: values[2] || 'Unknown',
            lat,
            lng,
            utc_time,
            local_time: values[9] || '',
            timestamp: parseUTCTime(utc_time),
          })
        }
        
        setStops(data)
        setCurrentIndex(Math.max(0, data.length - 1)) // Start at end for replay state
        setLoading(false)
        console.log(`Loaded ${data.length} flight stops from ${dataFile}`)
      })
      .catch(err => {
        console.error('Error loading flight data:', err)
        setLoading(false)
      })
  }, [dataFile])

  // Format timestamp to UTC string
  const formatUTCTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toISOString().replace('T', ' ').slice(0, 19)
  }, [])

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
    
    if (isPlaying && nextStop && travelProgress > 0) {
      // Follow the tip of the animated edge
      const interpolated = interpolateGreatCircle(currentStop, nextStop, travelProgress)
      targetLat = interpolated.lat
      targetLng = interpolated.lng
    } else {
      // When paused, center on current stop
      targetLat = currentStop.lat
      targetLng = currentStop.lng
    }
    
    // Only set lat/lng, preserve user's altitude/zoom
    const currentPov = globeRef.current.pointOfView()
    globeRef.current.pointOfView(
      { lat: targetLat, lng: targetLng, altitude: currentPov?.altitude ?? 2 }, 
      isPlaying ? 0 : 300  // No animation during playback to avoid zoom fighting
    )
  }, [currentIndex, stops, globeReady, isPlaying, travelProgress])

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
    setCurrentIndex(newIndex)
    if (isPlaying && stops.length > 0) {
      playStartTime.current = Date.now()
      playStartIndex.current = newIndex
      playStartSimTime.current = stops[newIndex].timestamp
    }
  }, [isPlaying, stops])

  const isAtEnd = stops.length > 0 && currentIndex >= stops.length - 1

  const togglePlay = useCallback(() => {
    if (isAtEnd) {
      // Reset for replay - wipe all points
      setCurrentIndex(0)
      setIsPlaying(true)
      return
    }
    setIsPlaying(prev => !prev)
  }, [isAtEnd])

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
  const progress = stops.length > 0 ? ((currentIndex + 1) / stops.length) * 100 : 0

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
    
    // Current arc (animating in) - swap start/end so dash draws from current toward next
    if (isPlaying && currentStop && nextStop && travelProgress > 0) {
      arcs.push({
        startLat: nextStop.lat,
        startLng: nextStop.lng,
        endLat: currentStop.lat,
        endLng: currentStop.lng,
        opacity: 1,
        dashLength: travelProgress,
        altitude: calcArcAltitude(currentStop.lat, currentStop.lng, nextStop.lat, nextStop.lng),
      })
    }
    
    // Previous arc (fading out)
    if (isPlaying && currentStop && prevStop && travelProgress > 0 && travelProgress < 1) {
      arcs.push({
        startLat: currentStop.lat,
        startLng: currentStop.lng,
        endLat: prevStop.lat,
        endLng: prevStop.lng,
        opacity: 1 - travelProgress,
        dashLength: 1,
        altitude: calcArcAltitude(prevStop.lat, prevStop.lng, currentStop.lat, currentStop.lng),
      })
    }
    
    return arcs
  }, [isPlaying, currentStop, nextStop, prevStop, travelProgress, calcArcAltitude])

  return (
    <div className="relative w-full h-full bg-black">
      {/* Globe - shifted up to account for bottom HUD */}
      <div className="absolute inset-0" style={{ transform: 'translateY(-10%)' }}>
        {GlobeComponent && (
          <GlobeComponent
            ref={globeRef}
            width={typeof window !== 'undefined' ? window.innerWidth : 800}
            height={typeof window !== 'undefined' ? window.innerHeight : 600}
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
        {currentStop && (
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
            <span className="text-[#33ff33]/50">STOP:</span>
            <span>{(currentIndex + 1).toLocaleString()}</span>
            <span className="text-[#33ff33]/50">/</span>
            <span>{stops.length.toLocaleString()}</span>
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
          <button
            onClick={togglePlay}
            className="px-3 py-1 text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors text-xs border border-[#33ff33]/50"
          >
            {isPlaying ? '[ ▌▌ ]' : isAtEnd ? 'REPLAY' : '[ ▶ ]'}
          </button>
          
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
              max={Math.max(0, stops.length - 1)}
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
        </div>
        
        <div className="border-t border-[#33ff33]/30" />
        
        <div className="py-2 flex justify-between text-[#33ff33]/50 text-xs">
          <span>PROGRESS: {progress.toFixed(1)}%</span>
          <span>ETA: {isPlaying ? formatDuration(remainingPlaybackTime) : '-- : -- : --'}</span>
        </div>
      </div>
    </div>
  )
}

