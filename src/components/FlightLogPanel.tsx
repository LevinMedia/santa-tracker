'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Switch } from '@headlessui/react'

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

interface FlightLogPanelProps {
  isOpen: boolean
  onClose: () => void
  stops: FlightStop[]
  currentIndex: number
  onSelectStop: (index: number) => void
}

// Number of items to load per batch
const BATCH_SIZE = 50

export default function FlightLogPanel({
  isOpen,
  onClose,
  stops,
  currentIndex,
  onSelectStop,
}: FlightLogPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [loadedCount, setLoadedCount] = useState(BATCH_SIZE)
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedStop, setSelectedStop] = useState<FlightStop | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Freedom Units™ toggle (imperial measurements)
  const [useFreedomUnits, setUseFreedomUnits] = useState(false)
  
  // Load freedom units preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('useFreedomUnits')
    if (stored !== null) {
      setUseFreedomUnits(stored === 'true')
    }
  }, [])
  
  // Save freedom units preference to localStorage
  const handleFreedomUnitsChange = (enabled: boolean) => {
    setUseFreedomUnits(enabled)
    localStorage.setItem('useFreedomUnits', String(enabled))
  }
  
  // Unit conversion functions
  const celsiusToFahrenheit = (c: number) => (c * 9/5) + 32
  const mpsToMph = (mps: number) => mps * 2.237

  // Wind direction formatting
  const getCardinalDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    const index = Math.round(degrees / 22.5) % 16
    return directions[index]
  }

  // Arrow rotation: ➤ points right by default, rotate based on wind direction
  // Wind direction is where wind comes FROM, arrow shows where it goes TO
  const getWindArrowRotation = (degrees: number): number => {
    // Add 90° because ➤ points right (East) but 0° is North
    return (degrees + 90) % 360
  }

  const formatWindDirection = (degrees: number): React.ReactNode => {
    const cardinal = getCardinalDirection(degrees)
    const rotation = getWindArrowRotation(degrees)
    return (
      <span className="inline-flex items-center gap-1.5">
        {cardinal}
        <span 
          className="text-base font-bold leading-none"
          style={{ transform: `rotate(${rotation}deg)`, display: 'inline-block' }}
        >➤</span>
        ({degrees.toFixed(0)}°)
      </span>
    )
  }

  // Update URL with stop number (for sharing/deep linking)
  const updateUrlWithStop = useCallback((stopNumber: number | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (stopNumber !== null) {
      params.set('stop', stopNumber.toString())
    } else {
      params.delete('stop')
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`
    router.replace(newUrl, { scroll: false })
  }, [router, searchParams])

  // Open stop from URL parameter on load
  useEffect(() => {
    if (stops.length === 0) return
    
    const stopParam = searchParams.get('stop')
    if (stopParam) {
      const stopNumber = parseInt(stopParam, 10)
      const stop = stops.find(s => s.stop_number === stopNumber)
      if (stop) {
        setSelectedStop(stop)
        const originalIndex = stops.findIndex(s => s.stop_number === stopNumber)
        if (originalIndex !== -1) {
          onSelectStop(originalIndex)
        }
      }
    }
  }, [stops, searchParams, onSelectStop])

  // Reset state when the drawer opens so nothing is pre-selected and lazy loading restarts
  // (unless there's a stop param in the URL - that's handled by the URL effect)
  useEffect(() => {
    if (isOpen) {
      setLoadedCount(BATCH_SIZE)
      setSearchQuery('')
      // Only clear selected stop if there's no stop in URL
      if (!searchParams.get('stop')) {
        setSelectedStop(null)
      }
    }
  }, [isOpen, searchParams])

  // Reverse chronological order (most recent first = highest index first)
  const reversedStops = useMemo(() => {
    return [...stops].reverse()
  }, [stops])

  // Filter by search query
  const filteredStops = useMemo(() => {
    if (!searchQuery.trim()) return reversedStops
    const query = searchQuery.toLowerCase()
    return reversedStops.filter(
      (stop) =>
        stop.city.toLowerCase().includes(query) ||
        stop.country.toLowerCase().includes(query) ||
        stop.stop_number.toString().includes(query)
    )
  }, [reversedStops, searchQuery])

  // Lazy load - only show loadedCount items
  const visibleStops = useMemo(() => {
    return filteredStops.slice(0, loadedCount)
  }, [filteredStops, loadedCount])

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && loadedCount < filteredStops.length) {
          setLoadedCount((prev) => Math.min(prev + BATCH_SIZE, filteredStops.length))
        }
      },
      { threshold: 0.1 }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [loadedCount, filteredStops.length])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleStopClick = useCallback(
    (stop: FlightStop) => {
      // Find the original index in the stops array
      const originalIndex = stops.findIndex((s) => s.stop_number === stop.stop_number)
      if (originalIndex !== -1) {
        onSelectStop(originalIndex)
        setSelectedStop(stop)
        updateUrlWithStop(stop.stop_number)
      }
    },
    [stops, onSelectStop, updateUrlWithStop]
  )
  
  // Close detail modal and clear URL param
  const handleCloseDetail = useCallback(() => {
    setSelectedStop(null)
    updateUrlWithStop(null)
  }, [updateUrlWithStop])

  // Get previous and next stops for navigation
  const getAdjacentStops = useCallback(() => {
    if (!selectedStop) return { prev: null, next: null }
    const currentIdx = stops.findIndex(s => s.stop_number === selectedStop.stop_number)
    return {
      prev: currentIdx > 0 ? stops[currentIdx - 1] : null,
      next: currentIdx < stops.length - 1 ? stops[currentIdx + 1] : null,
    }
  }, [selectedStop, stops])

  const { prev: prevStop, next: nextStop } = getAdjacentStops()

  // Navigate to a specific stop
  const navigateToStop = useCallback((stop: FlightStop) => {
    const originalIndex = stops.findIndex(s => s.stop_number === stop.stop_number)
    if (originalIndex !== -1) {
      onSelectStop(originalIndex)
      setSelectedStop(stop)
      updateUrlWithStop(stop.stop_number)
    }
  }, [stops, onSelectStop, updateUrlWithStop])

  // Swipe handling for touch devices
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const minSwipeDistance = 50

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = null
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const distance = touchStartX.current - touchEndX.current
    const isSwipeLeft = distance > minSwipeDistance
    const isSwipeRight = distance < -minSwipeDistance

    if (isSwipeLeft && nextStop) {
      navigateToStop(nextStop)
    } else if (isSwipeRight && prevStop) {
      navigateToStop(prevStop)
    }

    touchStartX.current = null
    touchEndX.current = null
  }, [nextStop, prevStop, navigateToStop])

  // Format time for display (short version for list)
  const formatTime = (utcTime: string) => {
    if (!utcTime) return '--:--'
    const parts = utcTime.split(' ')
    return parts[1] || utcTime
  }

  // Format datetime for human-readable display (e.g., "December 25, 2024 12:00 AM")
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'N/A'
    try {
      // Parse "2024-12-25 11:00:00" format
      const date = new Date(dateTimeStr.replace(' ', 'T'))
      if (isNaN(date.getTime())) return dateTimeStr
      
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return dateTimeStr
    }
  }

  const formatOffset = (offset?: number) => {
    if (offset === undefined || Number.isNaN(offset)) return 'N/A'
    const sign = offset >= 0 ? '+' : '-'
    const absoluteOffset = Math.abs(offset)
    const hours = Math.floor(absoluteOffset)
    const minutes = Math.round((absoluteOffset - hours) * 60)
    const paddedMinutes = minutes.toString().padStart(2, '0')

    return `UTC${sign}${hours}${minutes ? `:${paddedMinutes}` : ''}`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Panel Container - Mobile: bottom drawer, Desktop: full-height right sidebar */}
      <div
        className={`
          fixed z-[1002] font-mono
          left-0 right-0 bottom-0 h-[50vh]
          md:left-auto md:right-0 md:top-0 md:bottom-0 md:h-full md:w-96
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0 md:translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
        `}
      >
        {/* Retro Window Frame */}
        <div className="h-full flex flex-col bg-black border border-[#33ff33]/60 md:border-r-0 md:border-t-0 md:border-b-0 md:border-l-2">
          {/* Title Bar - Retro OS Style */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#33ff33]/10 border-b border-[#33ff33]/40">
            <div className="flex items-center gap-2">
              {/* Window decoration dots */}
              <div className="hidden md:flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
              </div>
              <span className="text-[#33ff33] text-xs uppercase tracking-wider ml-2">
                📋 Flight Log
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors border border-[#33ff33]/50 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Drag Handle - Mobile only */}
          <div className="md:hidden flex justify-center py-2 border-b border-[#33ff33]/20">
            <div className="w-12 h-1 bg-[#33ff33]/40 rounded-full" />
          </div>

          {/* Search Bar */}
          <div className="flex-shrink-0 p-3 border-b border-[#33ff33]/30">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setLoadedCount(BATCH_SIZE) // Reset lazy load on search
                }}
                placeholder="SEARCH CITY, COUNTRY, OR STOP #..."
                className="w-full bg-black border border-[#33ff33]/50 text-[#33ff33] text-[16px] md:text-xs px-3 py-2 pl-8 placeholder-[#33ff33]/30 focus:outline-none focus:border-[#33ff33]"
                style={{ fontSize: '16px' }}
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#33ff33]/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#33ff33]/50 hover:text-[#33ff33] text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-2 text-[10px] text-[#33ff33]/40 uppercase tracking-wider">
              {filteredStops.length.toLocaleString()} stops
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          </div>

          {/* Stops List */}
            <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin">
              {visibleStops.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[#33ff33]/40 text-xs">
                  {searchQuery ? 'No stops found' : 'No flight data'}
                </div>
              ) : (
                <div className="divide-y divide-[#33ff33]/10">
                  {visibleStops.map((stop) => {
                  const originalIndex = stops.findIndex(
                    (s) => s.stop_number === stop.stop_number
                  )
                  const isVisited = originalIndex <= currentIndex
                  const isCurrent = originalIndex === currentIndex

                  return (
                    <button
                      key={stop.stop_number}
                      onClick={() => handleStopClick(stop)}
                      className={`
                        w-full text-left px-3 py-2.5 transition-colors
                        ${isCurrent 
                          ? 'bg-[#33ff33]/20 border-l-2 border-[#33ff33]' 
                          : isVisited 
                            ? 'hover:bg-[#33ff33]/10 border-l-2 border-transparent' 
                            : 'opacity-40 hover:bg-[#33ff33]/5 border-l-2 border-transparent'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#33ff33]/50 font-mono">
                              #{stop.stop_number.toString().padStart(5, '0')}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] bg-[#33ff33] text-black px-1 py-0.5 uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#33ff33] truncate mt-0.5">
                            {stop.city}
                          </div>
                          <div className="text-[10px] text-[#33ff33]/50 uppercase tracking-wider">
                            {stop.country}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] text-[#33ff33]/60">
                            {formatTime(stop.utc_time)}
                          </div>
                          <div className="text-[8px] text-[#33ff33]/30 uppercase">
                            UTC
                          </div>
                        </div>
                      </div>
                    </button>
                    )
                  })}

                  {/* Load more sentinel */}
                  {loadedCount < filteredStops.length && (
                    <div
                      ref={loadMoreRef}
                      className="py-4 text-center text-[#33ff33]/40 text-xs"
                    >
                      <div className="animate-pulse">Loading more...</div>
                    </div>
                  )}

                </div>
              )}
            </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-3 py-1.5 border-t border-[#33ff33]/30 bg-[#33ff33]/5">
            <div className="flex justify-between text-[10px] text-[#33ff33]/40 uppercase tracking-wider">
              <span>
                Showing {visibleStops.length} of {filteredStops.length}
              </span>
              <span>↕ Scroll for more</span>
            </div>
          </div>
        </div>
      </div>

      {selectedStop && (
        <div className="fixed inset-0 z-[1003] flex items-center justify-center md:px-4 font-mono">
          <div
            className="absolute inset-0 bg-black/70 hidden md:block"
            onClick={handleCloseDetail}
          />
          <div 
            className="relative w-full h-full md:h-auto md:max-w-xl bg-black md:border border-[#33ff33]/50 md:shadow-2xl md:shadow-[#33ff33]/20 flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#33ff33]/40 bg-[#33ff33]/10">
              <div>
                <div className="text-xs text-[#33ff33]/60 uppercase tracking-wider">
                  Stop #{selectedStop.stop_number.toString().padStart(5, '0')}
                </div>
                <div className="text-lg text-[#33ff33] mt-0.5">
                  {selectedStop.city}
                </div>
                <div className="text-[10px] text-[#33ff33]/50 uppercase tracking-wider">
                  {selectedStop.country}
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors px-3 py-1.5 flex items-center gap-1.5 border border-[#33ff33]/50 text-xs uppercase tracking-wider"
              >
                <span>✕</span>
                <span>Close</span>
              </button>
            </div>

            <div className="p-4 space-y-4 text-[#33ff33] flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Local Time</div>
                  <div className="text-sm">{formatDateTime(selectedStop.local_time)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60 mt-2">UTC Time</div>
                  <div className="text-sm">{formatDateTime(selectedStop.utc_time)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Timezone</div>
                  <div className="text-sm">{selectedStop.timezone || 'N/A'}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60 mt-2">UTC Offset</div>
                  <div className="text-sm">{formatOffset(selectedStop.utc_offset)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Coordinates</div>
                  <div className="text-sm">{selectedStop.lat.toFixed(4)}, {selectedStop.lng.toFixed(4)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Population</div>
                  <div className="text-sm">{selectedStop.population?.toLocaleString() ?? 'N/A'}</div>
                </div>
              </div>

              {/* Weather Section */}
              <div className="border-t border-[#33ff33]/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Weather Conditions</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[8px] uppercase tracking-wider text-[#33ff33]/40 leading-none">
                      Freedom Units<span className="text-[6px] align-super">™</span>
                    </span>
                    <Switch
                      checked={useFreedomUnits}
                      onChange={handleFreedomUnitsChange}
                      className={`
                        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full 
                        border border-[#33ff33]/50 transition-colors duration-200 ease-in-out
                        focus:outline-none focus-visible:ring-1 focus-visible:ring-[#33ff33]
                        ${useFreedomUnits ? 'bg-[#33ff33]/30' : 'bg-black'}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-4 w-4 transform rounded-full 
                          shadow-lg ring-0 transition duration-200 ease-in-out mt-px ml-px
                          ${useFreedomUnits 
                            ? 'translate-x-[16px] bg-[#33ff33]' 
                            : 'translate-x-0 bg-[#33ff33]/50'}
                        `}
                      />
                    </Switch>
                  </label>
                </div>
                {(typeof selectedStop.temperature_c === 'number' && !isNaN(selectedStop.temperature_c)) || selectedStop.weather_condition ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Temperature</div>
                      <div className="text-lg">
                        {typeof selectedStop.temperature_c === 'number' && !isNaN(selectedStop.temperature_c) 
                          ? useFreedomUnits
                            ? `${celsiusToFahrenheit(selectedStop.temperature_c).toFixed(1)}°F`
                            : `${selectedStop.temperature_c.toFixed(1)}°C`
                          : 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Conditions</div>
                      <div className="text-sm">{selectedStop.weather_condition || 'N/A'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Speed</div>
                      <div className="text-sm">
                        {typeof selectedStop.wind_speed_mps === 'number' && !isNaN(selectedStop.wind_speed_mps)
                          ? useFreedomUnits
                            ? `${mpsToMph(selectedStop.wind_speed_mps).toFixed(1)} mph`
                            : `${selectedStop.wind_speed_mps.toFixed(1)} m/s`
                          : 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Direction</div>
                      <div className="text-sm">
                        {typeof selectedStop.wind_direction_deg === 'number' && !isNaN(selectedStop.wind_direction_deg)
                          ? formatWindDirection(selectedStop.wind_direction_deg)
                          : 'N/A'}
                      </div>
                    </div>
                    {typeof selectedStop.wind_gust_mps === 'number' && !isNaN(selectedStop.wind_gust_mps) && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Gusts</div>
                        <div className="text-sm">
                          {useFreedomUnits
                            ? `${mpsToMph(selectedStop.wind_gust_mps).toFixed(1)} mph`
                            : `${selectedStop.wind_gust_mps.toFixed(1)} m/s`}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[#33ff33]/40">No weather data available</div>
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="flex-shrink-0 border-t border-[#33ff33]/40 bg-[#33ff33]/5 grid grid-cols-2">
              <button
                onClick={() => prevStop && navigateToStop(prevStop)}
                disabled={!prevStop}
                className={`
                  flex items-center gap-2 px-4 py-3 text-left border-r border-[#33ff33]/20 transition-colors
                  ${prevStop 
                    ? 'text-[#33ff33] hover:bg-[#33ff33]/10 active:bg-[#33ff33]/20' 
                    : 'text-[#33ff33]/20 cursor-not-allowed'}
                `}
              >
                <span className="text-lg">←</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] uppercase tracking-wider text-[#33ff33]/50">Previous</div>
                  <div className="text-xs truncate">
                    {prevStop ? prevStop.city : 'Start'}
                  </div>
                </div>
              </button>
              <button
                onClick={() => nextStop && navigateToStop(nextStop)}
                disabled={!nextStop}
                className={`
                  flex items-center gap-2 px-4 py-3 text-right transition-colors
                  ${nextStop 
                    ? 'text-[#33ff33] hover:bg-[#33ff33]/10 active:bg-[#33ff33]/20' 
                    : 'text-[#33ff33]/20 cursor-not-allowed'}
                `}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] uppercase tracking-wider text-[#33ff33]/50">Next</div>
                  <div className="text-xs truncate">
                    {nextStop ? nextStop.city : 'End'}
                  </div>
                </div>
                <span className="text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

