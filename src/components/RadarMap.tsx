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

export default function RadarMap({ dataFile = '/test-flight-1.csv' }: RadarMapProps) {
  const [stops, setStops] = useState<FlightStop[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(300)
  
  const playStartTime = useRef<number>(0)
  const playStartIndex = useRef<number>(0)
  const animationFrame = useRef<number>(0)

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

  // Real-time playback using timestamps
  useEffect(() => {
    if (!isPlaying || loading || stops.length === 0) return
    
    playStartTime.current = Date.now()
    playStartIndex.current = currentIndex
    const startMissionTime = stops[currentIndex].timestamp
    
    const animate = () => {
      const elapsed = Date.now() - playStartTime.current
      const scaledElapsed = elapsed * playSpeed
      const targetMissionTime = startMissionTime + scaledElapsed
      
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
  }, [isPlaying, loading, stops, playSpeed])

  // Update animation when speed changes during playback
  useEffect(() => {
    if (isPlaying) {
      playStartTime.current = Date.now()
      playStartIndex.current = currentIndex
    }
  }, [playSpeed])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value)
    setCurrentIndex(newIndex)
    if (isPlaying) {
      playStartTime.current = Date.now()
      playStartIndex.current = newIndex
    }
  }, [isPlaying])

  const togglePlay = useCallback(() => {
    if (currentIndex >= stops.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(prev => !prev)
  }, [currentIndex, stops.length])

  const currentStop = stops[currentIndex]
  const progress = stops.length > 0 ? ((currentIndex + 1) / stops.length) * 100 : 0

  return (
    <div className="relative w-full h-full">
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
      
      {/* Scrubber Control Panel */}
      <div className="absolute bottom-20 left-6 right-6 z-[1000]">
        {/* Current Stop Info */}
        <div className="mb-3 flex items-center justify-between text-green-400 font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-green-400/60">STOP</span>
            <span className="text-lg font-bold">{currentIndex + 1}</span>
            <span className="text-green-400/60">/ {stops.length}</span>
          </div>
          {currentStop && (
            <div className="flex items-center gap-4">
              <span className="text-green-400/60">LOCATION</span>
              <span>{currentStop.city}, {currentStop.country}</span>
            </div>
          )}
          {currentStop?.utc_time && (
            <div className="flex items-center gap-2">
              <span className="text-green-400/60">UTC</span>
              <span>{currentStop.utc_time}</span>
            </div>
          )}
        </div>
        
        {/* Scrubber */}
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          {/* Timeline Scrubber */}
          <div className="flex-1 relative">
            <div className="absolute inset-0 h-2 bg-green-900/30 rounded-full top-1/2 -translate-y-1/2" />
            <div 
              className="absolute h-2 bg-green-500/50 rounded-full top-1/2 -translate-y-1/2 transition-all"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min="0"
              max={Math.max(0, stops.length - 1)}
              value={currentIndex}
              onChange={handleScrub}
              className="relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-green-400
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(74,222,128,0.5)]
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:bg-green-400
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
          
          {/* Speed Control */}
          <div className="flex items-center gap-2">
            <span className="text-green-400/60 font-mono text-xs">SPEED</span>
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
              className="bg-green-900/30 border border-green-500/30 text-green-400 text-xs font-mono px-2 py-1 rounded"
            >
              <option value="1">1x (Real)</option>
              <option value="2">2x</option>
              <option value="10">10x</option>
              <option value="60">60x</option>
              <option value="300">MAX</option>
            </select>
          </div>
        </div>
        
        {/* Progress and ETA */}
        <div className="mt-2 flex justify-between text-green-400/40 font-mono text-xs">
          <span>{progress.toFixed(1)}% COMPLETE</span>
          <span>ETA: {isPlaying ? formatDuration(remainingPlaybackTime) : '--'}</span>
        </div>
      </div>
    </div>
  )
}
