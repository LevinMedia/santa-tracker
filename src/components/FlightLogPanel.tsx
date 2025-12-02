'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

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

export default function FlightLogPanel({
  isOpen,
  onClose,
  stops,
  currentIndex,
  onSelectStop,
}: FlightLogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedStop, setSelectedStop] = useState<FlightStop | null>(null)

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
      }
    },
    [stops, onSelectStop]
  )

  // Format time for display
  const formatTime = (utcTime: string) => {
    if (!utcTime) return '--:--'
    const parts = utcTime.split(' ')
    return parts[1] || utcTime
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
            {filteredStops.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#33ff33]/40 text-xs">
                {searchQuery ? 'No stops found' : 'No flight data'}
              </div>
            ) : (
              <div className="divide-y divide-[#33ff33]/10">
                {filteredStops.map((stop) => {
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

              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-3 py-1.5 border-t border-[#33ff33]/30 bg-[#33ff33]/5">
            <div className="flex justify-between text-[10px] text-[#33ff33]/40 uppercase tracking-wider">
              <span>
                Showing {filteredStops.length} stop{filteredStops.length === 1 ? '' : 's'}
              </span>
              <span>↕ Scroll for more</span>
            </div>
          </div>
        </div>
      </div>

      {selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelectedStop(null)}
          />
          <div className="relative w-full max-w-xl bg-black border border-[#33ff33]/50 shadow-2xl shadow-[#33ff33]/20">
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#33ff33]/30">
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
                onClick={() => setSelectedStop(null)}
                className="text-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors w-7 h-7 flex items-center justify-center border border-[#33ff33]/50 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 text-[#33ff33]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">UTC Time</div>
                  <div className="text-sm">{selectedStop.utc_time || 'N/A'}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Local Time</div>
                  <div className="text-sm">{selectedStop.local_time || 'N/A'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">Timezone</div>
                  <div className="text-sm">{selectedStop.timezone || 'N/A'}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60">UTC Offset</div>
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

              {(selectedStop.temperature_c !== undefined || selectedStop.weather_condition) && (
                <div className="border border-[#33ff33]/40 p-3 bg-[#33ff33]/5">
                  <div className="text-[10px] uppercase tracking-wider text-[#33ff33]/60 mb-1">Weather</div>
                  <div className="text-sm flex flex-wrap gap-x-3 gap-y-1 items-center">
                    {selectedStop.temperature_c !== undefined && (
                      <span>{selectedStop.temperature_c.toFixed(1)}°C</span>
                    )}
                    {selectedStop.weather_condition && (
                      <span className="text-[#33ff33]/80">{selectedStop.weather_condition}</span>
                    )}
                    {selectedStop.wind_speed_mps !== undefined && (
                      <span>Wind {selectedStop.wind_speed_mps.toFixed(1)} m/s</span>
                    )}
                    {selectedStop.wind_direction_deg !== undefined && (
                      <span>↗ {selectedStop.wind_direction_deg.toFixed(0)}°</span>
                    )}
                    {selectedStop.wind_gust_mps !== undefined && (
                      <span>Gusts {selectedStop.wind_gust_mps.toFixed(1)} m/s</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

