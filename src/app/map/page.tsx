'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamically import the map component to avoid SSR issues with Leaflet
const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-green-400 font-mono text-sm animate-pulse">
        INITIALIZING RADAR SYSTEMS...
      </div>
    </div>
  ),
})

export default function MapPage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Radar grid overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Horizontal scan lines */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 65, 0.5) 2px, rgba(0, 255, 65, 0.5) 4px)',
          }}
        />
        
        {/* Vertical scan lines */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0, 255, 65, 0.3) 4px, rgba(0, 255, 65, 0.3) 6px)',
          }}
        />
        
        {/* Radial gradient vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0, 0, 0, 0.7) 100%)',
          }}
        />
        
        {/* CRT screen curve effect */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 20, 0, 0.3) 100%)',
          }}
        />
      </div>

      {/* Green tint overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 mix-blend-overlay"
        style={{
          background: 'linear-gradient(180deg, rgba(0, 255, 65, 0.08) 0%, rgba(0, 200, 50, 0.05) 100%)',
        }}
      />

      {/* Animated horizontal scan beam */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div 
          className="absolute left-0 right-0 h-32 animate-scan-beam"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 255, 65, 0.08) 40%, rgba(0, 255, 65, 0.15) 50%, rgba(0, 255, 65, 0.08) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* Map container with scrubber */}
      <div 
        className="absolute inset-0"
        style={{
          filter: 'sepia(15%) saturate(120%) hue-rotate(45deg) brightness(0.95)',
        }}
      >
        {isClient && <RadarMap dataFile="/test-flight-1.csv" />}
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 p-6 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 pointer-events-auto">
            <Link 
              href="/"
              className="flex items-center gap-2 text-green-400/80 hover:text-green-400 transition-colors font-mono text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              BACK
            </Link>
            <div className="w-px h-4 bg-green-500/30" />
            <h1 className="text-green-400 font-mono text-lg tracking-widest">
              SANTA TRACKER // RADAR
            </h1>
          </div>
          
          <div className="flex items-center gap-4 text-green-400/60 font-mono text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-green-500/30 z-20 pointer-events-none" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-green-500/30 z-20 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-green-500/30 z-20 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-green-500/30 z-20 pointer-events-none" />
    </div>
  )
}
