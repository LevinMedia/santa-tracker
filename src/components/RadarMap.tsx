'use client'

import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useCallback, useRef } from 'react'

interface FlightStop {
  stop_number: number
  city: string
  country: string
  lat: number
  lng: number
  utc_time: string
  local_time: string
  timestamp: number // Unix timestamp in ms
}

interface RadarMapProps {
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

// Component to center map on current stop (horizontal only)
function MapController({ currentStop }: { currentStop: FlightStop | null }) {
  const map = useMap()
  const lastLng = useRef<number>(0)
  
  useEffect(() => {
    if (currentStop) {
      const currentCenter = map.getCenter()
      // Only pan horizontally - keep the same latitude view
      // Smooth pan to follow Santa's longitude
      if (Math.abs(currentStop.lng - lastLng.current) > 5) {
        map.panTo([currentCenter.lat, currentStop.lng], { 
          animate: true, 
          duration: 0.3,
          noMoveStart: true 
        })
        lastLng.current = currentStop.lng
      }
    }
  }, [currentStop, map])
  
  return null
}

const SPEED_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 10, label: '10x' },
  { value: 60, label: '60x' },
  { value: 300, label: 'MAX' },
]

export default function RadarMap({ dataFile = '/test-flight-1.csv' }: RadarMapProps) {
  const [stops, setStops] = useState<FlightStop[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(300)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [displayTime, setDisplayTime] = useState<string>('')
  
  const playStartTime = useRef<number>(0)
  const playStartIndex = useRef<number>(0)
  const playStartSimTime = useRef<number>(0)
  const animationFrame = useRef<number>(0)
  const speedMenuRef = useRef<HTMLDivElement>(null)

  // Mission timing
  const missionStart = stops.length > 0 ? stops[0].timestamp : 0
  const missionEnd = stops.length > 0 ? stops[stops.length - 1].timestamp : 0
  
  // Playback time remaining
  const currentStopTime = stops[currentIndex]?.timestamp || missionStart
  const remainingMissionTime = missionEnd - currentStopTime
  const remainingPlaybackTime = remainingMissionTime / playSpeed

  // Load flight data
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
        setCurrentIndex(0)
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

  // Real-time playback using timestamps
  useEffect(() => {
    if (!isPlaying || loading || stops.length === 0) return
    
    playStartTime.current = Date.now()
    playStartIndex.current = currentIndex
    playStartSimTime.current = stops[currentIndex].timestamp
    
    const animate = () => {
      const elapsed = Date.now() - playStartTime.current
      const scaledElapsed = elapsed * playSpeed
      const targetMissionTime = playStartSimTime.current + scaledElapsed
      
      // Update display time in real-time
      setDisplayTime(formatUTCTime(targetMissionTime))
      
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

  // Update animation when speed changes during playback
  useEffect(() => {
    if (isPlaying && stops.length > 0) {
      playStartTime.current = Date.now()
      playStartIndex.current = currentIndex
      playStartSimTime.current = stops[currentIndex].timestamp
    }
  }, [playSpeed])

  // Update display time when not playing (from current stop)
  useEffect(() => {
    if (!isPlaying && stops.length > 0 && stops[currentIndex]) {
      setDisplayTime(stops[currentIndex].utc_time)
    }
  }, [isPlaying, currentIndex, stops])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value)
    setCurrentIndex(newIndex)
    if (isPlaying && stops.length > 0) {
      playStartTime.current = Date.now()
      playStartIndex.current = newIndex
      playStartSimTime.current = stops[newIndex].timestamp
    }
  }, [isPlaying, stops])

  const togglePlay = useCallback(() => {
    if (currentIndex >= stops.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(prev => !prev)
  }, [currentIndex, stops.length])

  // Close speed menu when clicking outside
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

  return (
    <div className="relative w-full h-full">
      {/* Map with filter - only applies to map, not controls */}
      <div 
        className="absolute inset-0"
        style={{
          filter: 'sepia(15%) saturate(120%) hue-rotate(45deg) brightness(0.95)',
        }}
      >
        <MapContainer
          center={[25, 0]}
          zoom={2.5}
          style={{ height: '100%', width: '100%', background: '#000' }}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          minZoom={2}
          maxZoom={6}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          
          {/* Map controller to follow current stop */}
          <MapController currentStop={currentStop} />
          
          {/* Only show visited stops - additive */}
          {!loading && stops.slice(0, currentIndex + 1).map((stop) => (
            <CircleMarker
              key={`visited-${stop.stop_number}`}
              center={[stop.lat, stop.lng]}
              radius={1}
              pathOptions={{
                color: '#39ff14',
                fillColor: '#39ff14',
                fillOpacity: 1,
                weight: 0,
              }}
            />
          ))}
          
          {/* Current stop - larger glow */}
          {currentStop && (
            <CircleMarker
              key="current"
              center={[currentStop.lat, currentStop.lng]}
              radius={4}
              pathOptions={{
                color: '#fff',
                fillColor: '#39ff14',
                fillOpacity: 1,
                weight: 2,
              }}
            />
          )}
        </MapContainer>
      </div>
      
      {/* Scrubber Control Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] font-mono px-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8"
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.4)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        {/* Top border */}
        <div className="text-[#33ff33]/60 text-xs border-t border-[#33ff33]/40" />
        
        {/* Current Stop Info */}
        <div className="py-2 flex items-center justify-between text-[#33ff33] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#33ff33]/50">STOP:</span>
            <span>{String(currentIndex + 1).padStart(5, '0')}</span>
            <span className="text-[#33ff33]/50">/</span>
            <span>{stops.length.toLocaleString()}</span>
          </div>
          {currentStop && (
            <div className="flex items-center gap-2">
              <span className="text-[#33ff33]/50">LOC:</span>
              <span className="uppercase">{currentStop.city}, {currentStop.country}</span>
            </div>
          )}
          {displayTime && (
            <div className="flex items-center gap-2">
              <span className="text-[#33ff33]/50">UTC:</span>
              <span>{displayTime}</span>
            </div>
          )}
        </div>
        
        {/* Middle border */}
        <div className="border-t border-[#33ff33]/30" />
        
        {/* Scrubber */}
        <div className="py-2 flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="px-3 py-1 text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors text-xs border border-[#33ff33]/50"
          >
            {isPlaying ? '[ ▌▌ ]' : '[ ▶ ]'}
          </button>
          
          {/* Timeline Scrubber */}
          <div className="flex-1 relative h-4 flex items-center">
            {/* Track background */}
            <div className="absolute inset-x-0 h-1 bg-[#33ff33]/20" />
            {/* Progress fill */}
            <div 
              className="absolute h-1 bg-[#33ff33]/60 transition-all"
              style={{ width: `${progress}%` }}
            />
            {/* Block markers */}
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
          
          {/* Speed Control */}
          <div className="flex items-center gap-2" ref={speedMenuRef}>
            <span className="text-[#33ff33]/50 text-xs">SPD:</span>
            <div className="relative">
              <button
                onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                className="bg-black border border-[#33ff33]/50 text-[#33ff33] text-xs px-3 py-1 cursor-pointer hover:bg-[#33ff33]/10 focus:outline-none focus:border-[#33ff33] flex items-center gap-3"
                style={{
                  textShadow: '0 0 5px rgba(51, 255, 51, 0.8)',
                }}
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
                  style={{
                    textShadow: '0 0 5px rgba(51, 255, 51, 0.8)',
                  }}
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
        
        {/* Bottom border */}
        <div className="border-t border-[#33ff33]/30" />
        
        {/* Progress and ETA */}
        <div className="py-2 flex justify-between text-[#33ff33]/50 text-xs">
          <span>PROGRESS: {progress.toFixed(1)}%</span>
          <span>ETA: {isPlaying ? formatDuration(remainingPlaybackTime) : '-- : -- : --'}</span>
        </div>
      </div>
    </div>
  )
}
