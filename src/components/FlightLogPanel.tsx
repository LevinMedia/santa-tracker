'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
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
  isReplaying?: boolean
  isLive?: boolean
  liveIndex?: number
}

// Number of items to load per batch
const BATCH_SIZE = 50

// Wrapped in memo to prevent re-renders when parent's travelProgress changes
const FlightLogPanel = memo(function FlightLogPanel({
  isOpen,
  onClose,
  stops,
  currentIndex,
  onSelectStop,
  isReplaying = false,
  isLive = false,
  liveIndex = 0,
}: FlightLogPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [loadedCount, setLoadedCount] = useState(BATCH_SIZE)
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedStop, setSelectedStop] = useState<FlightStop | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Backfilled weather for selected stop (when original is missing)
  const [backfilledWeather, setBackfilledWeather] = useState<{
    temperature_c?: number
    weather_condition?: string
    wind_speed_mps?: number
    wind_direction_deg?: number
    wind_gust_mps?: number
  } | null>(null)
  const [isBackfilling, setIsBackfilling] = useState(false)
  
  // Track if we've entered replay mode (persists even when paused)
  const [inReplayMode, setInReplayMode] = useState(false)
  
  // Freedom Units™ toggle (imperial measurements)
  const [useFreedomUnits, setUseFreedomUnits] = useState(false)
  
  // Draggable window state (desktop only)
  const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 })
  
  // Track desktop breakpoint
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  // Ticker for updating relative times
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])
  
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
  
  // Sneaky backfill: fetch historical weather when viewing a stop without weather (live mode only)
  useEffect(() => {
    if (!isLive || !selectedStop) {
      setBackfilledWeather(null)
      return
    }
    
    // Already has weather data
    if (typeof selectedStop.temperature_c === 'number' && !isNaN(selectedStop.temperature_c)) {
      setBackfilledWeather(null)
      return
    }
    
    // Backfill missing weather
    const backfillWeather = async () => {
      setIsBackfilling(true)
      try {
        const response = await fetch('/api/weather/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stop_number: selectedStop.stop_number,
            lat: selectedStop.lat,
            lng: selectedStop.lng,
            utc_time: selectedStop.utc_time,
          })
        })
        
        const data = await response.json()
        
        if (data.success && data.weather) {
          setBackfilledWeather(data.weather)
          console.log(`🌤️ Backfilled weather for ${selectedStop.city}: ${data.weather.temperature_c}°C`)
        }
      } catch (error) {
        console.error('Error backfilling weather:', error)
      } finally {
        setIsBackfilling(false)
      }
    }
    
    backfillWeather()
  }, [isLive, selectedStop])
  
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

  // Track previous isOpen state to detect fresh opens
  const prevIsOpenRef = useRef(isOpen)
  
  // Reset state when the drawer opens fresh (not when searchParams changes while open)
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    
    if (wasJustOpened) {
      setLoadedCount(BATCH_SIZE)
      setSearchQuery('')
      setInReplayMode(false) // Reset replay mode on fresh open
      // Only clear selected stop if there's no stop in URL
      if (!searchParams.get('stop')) {
        setSelectedStop(null)
      }
    }
  }, [isOpen, searchParams])
  
  // Enter replay mode when replay starts OR when user scrubs to a position not at the end
  // (and stay in it until drawer closes)
  useEffect(() => {
    if (isReplaying) {
      setInReplayMode(true)
    }
  }, [isReplaying])

  // Also enter replay mode when currentIndex changes to a position before the end
  useEffect(() => {
    if (stops.length > 0 && currentIndex < stops.length - 1) {
      setInReplayMode(true)
    }
  }, [currentIndex, stops.length])

  // Build the base list depending on mode
  // Optimization: slice() already creates a copy, so we can reverse() in place
  const baseStops = useMemo(() => {
    if (isLive) {
      // Live mode: only show stops up to liveIndex (what has actually happened)
      return stops.slice(0, liveIndex + 1).reverse() // Most recently visited at top
    } else if (inReplayMode) {
      // In replay mode: only show visited stops (0 to currentIndex), newest visited at top
      return stops.slice(0, currentIndex + 1).reverse() // Most recently visited at top
    } else {
      // Browsing: all stops, most recent (highest index) first
      return stops.slice().reverse()
    }
  }, [stops, currentIndex, inReplayMode, isLive, liveIndex])

  // Filter by search query
  const filteredStops = useMemo(() => {
    if (!searchQuery.trim()) return baseStops
    const query = searchQuery.toLowerCase()
    return baseStops.filter(
      (stop) =>
        stop.city.toLowerCase().includes(query) ||
        stop.country.toLowerCase().includes(query) ||
        stop.stop_number.toString().includes(query)
    )
  }, [baseStops, searchQuery])

  // Lazy load - scroll down for more
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

  // Scroll to current stop when scrubbing - only if already in DOM (don't mass-load items)
  const lastScrolledIndexRef = useRef<number>(-1)
  
  useEffect(() => {
    if (!isOpen || stops.length === 0) return
    
    const currentStop = stops[currentIndex]
    if (!currentStop) return
    
    // Don't re-scroll if we already scrolled to this index
    if (lastScrolledIndexRef.current === currentIndex) return
    lastScrolledIndexRef.current = currentIndex
    
    // Only scroll if the element is already in the DOM (don't load thousands of items)
    requestAnimationFrame(() => {
      const stopElement = document.querySelector(`[data-stop-number="${currentStop.stop_number}"]`)
      if (stopElement) {
        stopElement.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    })
  }, [currentIndex, isOpen, stops])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
        return
      }
      
      // Arrow key navigation when panel is open (works even during playback)
      // Down = earlier stop (lower index), Up = later stop (higher index)
      if (isOpen && !selectedStop) {
        if (e.key === 'ArrowDown' && currentIndex > 0) {
          e.preventDefault()
          e.stopPropagation()
          onSelectStop(currentIndex - 1)
        } else if (e.key === 'ArrowUp' && currentIndex < stops.length - 1) {
          e.preventDefault()
          e.stopPropagation()
          onSelectStop(currentIndex + 1)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose, currentIndex, stops.length, onSelectStop, selectedStop])

  const handleStopClick = useCallback(
    (stop: FlightStop) => {
      // Find the original index in the stops array
      const originalIndex = stops.findIndex((s) => s.stop_number === stop.stop_number)
      if (originalIndex !== -1) {
        // During replay, just open the detail modal without jumping the globe
        // When browsing, jump to that stop on the globe
        if (!isReplaying) {
          onSelectStop(originalIndex)
        }
        setSelectedStop(stop)
        updateUrlWithStop(stop.stop_number)
      }
    },
    [stops, onSelectStop, updateUrlWithStop, isReplaying]
  )
  
  // Close detail modal and clear URL param
  const handleCloseDetail = useCallback(() => {
    setSelectedStop(null)
    updateUrlWithStop(null)
    // Reset window position when closing
    setWindowPosition({ x: 0, y: 0 })
  }, [updateUrlWithStop])

  // Draggable window handlers (desktop only)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only enable dragging on desktop
    if (!isDesktop) return
    
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      windowX: windowPosition.x,
      windowY: windowPosition.y,
    }
    e.preventDefault()
  }, [windowPosition, isDesktop])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    
    setWindowPosition({
      x: dragStartRef.current.windowX + deltaX,
      y: dragStartRef.current.windowY + deltaY,
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add/remove mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

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

  // Navigate to a specific stop (in detail modal)
  const navigateToStop = useCallback((stop: FlightStop) => {
    const originalIndex = stops.findIndex(s => s.stop_number === stop.stop_number)
    if (originalIndex !== -1) {
      // During replay, just show the detail without jumping the globe
      if (!isReplaying) {
        onSelectStop(originalIndex)
      }
      setSelectedStop(stop)
      updateUrlWithStop(stop.stop_number)
    }
  }, [stops, onSelectStop, updateUrlWithStop, isReplaying])

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

  // Format local time for display using the CSV-provided local_time string
  const formatLocalTimeWithDate = (localTime: string) => {
    if (!localTime) return '--:--'
    // localTime is already in format "2025-12-05 00:00:00"
    // Just format it nicely without any timezone conversion
    const parts = localTime.split(' ')
    if (parts.length !== 2) return localTime

    const [datePart, timePart] = parts
    const [, month, day] = datePart.split('-')
    const [hour, minute] = timePart.split(':')

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthName = months[parseInt(month) - 1] || month

    // Convert to 12-hour format
    const hourNum = parseInt(hour)
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
    const ampm = hourNum < 12 ? 'AM' : 'PM'

    return `${monthName} ${parseInt(day)}, ${hour12}:${minute} ${ampm}`
  }

  // Format relative time (e.g., "2h 30m 15s ago" if < 24 hours, otherwise "2 days ago")
  const formatRelativeTime = (utcTime: string): string => {
    if (!utcTime) return ''
    try {
      const date = new Date(utcTime.replace(' ', 'T') + 'Z')
      if (isNaN(date.getTime())) return ''
      
      const now = Date.now()
      const diff = now - date.getTime()
      
      // If in the future, show "upcoming"
      if (diff < 0) return 'upcoming'
      
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      
      if (days > 0) {
        return `${days}d ago`
      }
      
      // Less than 24 hours - show h m s
      const h = hours
      const m = minutes % 60
      const s = seconds % 60
      
      if (h > 0) {
        return `${h}h ${m}m ${s}s ago`
      } else if (m > 0) {
        return `${m}m ${s}s ago`
      } else {
        return `${s}s ago`
      }
    } catch {
      return ''
    }
  }

  // Format datetime for human-readable display (e.g., "December 25, 2024 at 12:00 AM")
  // Uses the local time string directly from CSV without timezone conversion
  const formatLocalDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'N/A'
    try {
      // dateTimeStr is in format "2024-12-25 11:00:00"
      const parts = dateTimeStr.split(' ')
      if (parts.length !== 2) return dateTimeStr
      
      const [datePart, timePart] = parts
      const [year, month, day] = datePart.split('-')
      const [hour, minute] = timePart.split(':')
      
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
      const monthName = months[parseInt(month) - 1] || month
      
      // Convert to 12-hour format
      const hourNum = parseInt(hour)
      const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
      const ampm = hourNum < 12 ? 'AM' : 'PM'
      
      return `${monthName} ${parseInt(day)}, ${year} at ${hour12}:${minute} ${ampm}`
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
          left-0 right-0 bottom-0 h-[45vh]
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
              className="flex items-center gap-1.5 bg-[#33ff33] text-black border border-[#33ff33] hover:bg-black hover:text-[#33ff33] transition-colors text-xs px-2 py-1"
            >
              <span>✕</span>
              <span>CLOSE</span>
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
                  const isSelected = selectedStop?.stop_number === stop.stop_number

                  return (
                    <button
                      key={stop.stop_number}
                      data-stop-number={stop.stop_number}
                      onClick={() => handleStopClick(stop)}
                      className={`
                        w-full text-left px-3 py-2.5 transition-colors border-l-2
                        ${isSelected
                          ? 'bg-[#33ff33] text-black border-[#33ff33]'
                          : isCurrent 
                            ? 'bg-[#33ff33]/20 border-[#33ff33]' 
                            : isVisited 
                              ? 'bg-[#33ff33]/5 border-[#33ff33]/30 hover:bg-[#33ff33]/10' 
                              : 'opacity-40 border-transparent hover:bg-[#33ff33]/5'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-black/60' : 'text-[#33ff33]/50'}`}>
                              #{stop.stop_number.toString().padStart(5, '0')}
                            </span>
                            {isCurrent && !isSelected && (
                              <span className="text-[8px] bg-[#33ff33] text-black px-1 py-0.5 uppercase tracking-wider">
                                Last Verified Location
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[8px] bg-black text-[#33ff33] px-1 py-0.5 uppercase tracking-wider">
                                Viewing
                              </span>
                            )}
                          </div>
                          <div className={`text-sm truncate mt-0.5 ${isSelected ? 'text-black' : 'text-[#33ff33]'}`}>
                            {stop.city}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-black/60' : 'text-[#33ff33]/50'}`}>
                            {stop.country}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-[9px] ${isSelected ? 'text-black/60' : 'text-[#33ff33]/50'}`}>
                            {formatRelativeTime(stop.utc_time)}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-black/70' : 'text-[#33ff33]/60'}`}>
                            {formatLocalTimeWithDate(stop.local_time)}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-black/70' : 'text-[#33ff33]/60'}`}>
                            {formatOffset(stop.utc_offset)}
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
                {isLive 
                  ? `${liveIndex + 1} stops • LIVE`
                  : inReplayMode 
                    ? `${currentIndex + 1} stops visited${!isReplaying ? ' • Paused' : ''}`
                    : `Showing ${visibleStops.length} of ${filteredStops.length}`
                }
              </span>
              {!inReplayMode && !isLive && loadedCount < filteredStops.length && (
                <span>↓ Scroll for more</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedStop && (
        <div className="fixed inset-0 z-[1003] flex items-center justify-center md:items-start md:justify-start md:pt-16 md:pl-6 md:pointer-events-none font-mono">
          {/* Mobile backdrop only */}
          <div
            className="absolute inset-0 bg-black/70 md:hidden"
            onClick={handleCloseDetail}
          />
          <div 
            className="relative w-full h-full md:h-auto md:max-w-xl md:max-h-[calc(100vh-8rem)] bg-black md:border border-[#33ff33]/50 md:shadow-2xl md:shadow-[#33ff33]/20 flex flex-col md:pointer-events-auto md:rounded-lg"
            style={isDesktop ? {
              transform: `translate(${windowPosition.x}px, ${windowPosition.y}px)`,
            } : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className={`flex items-center justify-between px-4 py-3 border-b border-[#33ff33]/40 bg-[#33ff33]/10 md:rounded-t-lg ${isDragging ? 'cursor-grabbing' : 'md:cursor-grab'}`}
              onMouseDown={handleDragStart}
            >
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
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Visited</div>
                  <div className="text-sm">{formatRelativeTime(selectedStop.utc_time)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60 mt-2">Local Time</div>
                  <div className="text-sm">{formatLocalDateTime(selectedStop.local_time)}</div>
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
                {(() => {
                  // Use backfilled weather as fallback
                  const weather = {
                    temperature_c: selectedStop.temperature_c ?? backfilledWeather?.temperature_c,
                    weather_condition: selectedStop.weather_condition ?? backfilledWeather?.weather_condition,
                    wind_speed_mps: selectedStop.wind_speed_mps ?? backfilledWeather?.wind_speed_mps,
                    wind_direction_deg: selectedStop.wind_direction_deg ?? backfilledWeather?.wind_direction_deg,
                    wind_gust_mps: selectedStop.wind_gust_mps ?? backfilledWeather?.wind_gust_mps,
                  }
                  const hasWeather = (typeof weather.temperature_c === 'number' && !isNaN(weather.temperature_c)) || weather.weather_condition
                  
                  if (isBackfilling) {
                    return <div className="text-sm text-[#33ff33]/40 animate-pulse">Loading weather data...</div>
                  }
                  
                  if (!hasWeather) {
                    return <div className="text-sm text-[#33ff33]/40">No weather data available</div>
                  }
                  
                  return (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Temperature</div>
                        <div className="text-lg">
                          {typeof weather.temperature_c === 'number' && !isNaN(weather.temperature_c) 
                            ? useFreedomUnits
                              ? `${celsiusToFahrenheit(weather.temperature_c).toFixed(1)}°F`
                              : `${weather.temperature_c.toFixed(1)}°C`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Conditions</div>
                        <div className="text-sm">{weather.weather_condition || 'N/A'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Speed</div>
                        <div className="text-sm">
                          {typeof weather.wind_speed_mps === 'number' && !isNaN(weather.wind_speed_mps)
                            ? useFreedomUnits
                              ? `${mpsToMph(weather.wind_speed_mps).toFixed(1)} mph`
                              : `${weather.wind_speed_mps.toFixed(1)} m/s`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Direction</div>
                        <div className="text-sm">
                          {typeof weather.wind_direction_deg === 'number' && !isNaN(weather.wind_direction_deg)
                            ? formatWindDirection(weather.wind_direction_deg)
                            : 'N/A'}
                        </div>
                      </div>
                      {typeof weather.wind_gust_mps === 'number' && !isNaN(weather.wind_gust_mps) && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/40">Wind Gusts</div>
                          <div className="text-sm">
                            {useFreedomUnits
                              ? `${mpsToMph(weather.wind_gust_mps).toFixed(1)} mph`
                              : `${weather.wind_gust_mps.toFixed(1)} m/s`}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
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
})

export default FlightLogPanel
