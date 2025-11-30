'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamically import the map component to avoid SSR issues with Leaflet
const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-black font-mono"
      style={{
        textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.4)',
      }}
    >
      <div className="text-sm space-y-1">
        <div className="text-[#33ff33] animate-pulse">Accessing NORAD mainframe...</div>
        <div className="text-[#33ff33] animate-pulse" style={{ animationDelay: '0.2s' }}>连接中国卫星网络...</div>
        <div className="text-[#33ff33] animate-pulse" style={{ animationDelay: '0.4s' }}>Подключение к российской системе...</div>
        <div className="text-[#33ff33] animate-pulse" style={{ animationDelay: '0.6s' }}>Bypassing security protocols...</div>
        <div className="mt-4 text-[#33ff33]/60">SYSTEM STATUS........ STANDBY</div>
        <div className="text-[#33ff33]/60">SANTA ACTIVITY....... NOT DETECTED</div>
      </div>
    </div>
  ),
})

export default function MapPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // ESC key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return (
    <div className="fixed inset-0 w-full bg-black overflow-hidden">
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
      <div className="absolute inset-0">
        {isClient && <RadarMap dataFile="/test-flight-1.csv" />}
      </div>

      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 z-20 px-4 pointer-events-none font-mono"
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.4)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: '1rem',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 pointer-events-auto">
            <Link 
              href="/"
              className="text-[#33ff33]/80 hover:bg-[#33ff33] hover:text-black transition-colors text-xs px-2 py-1 border border-[#33ff33]/50"
            >
              [ESC] BACK
            </Link>
            <span className="text-[#33ff33]/30">│</span>
            <h1 className="text-[#33ff33] text-sm tracking-wider">
              SANTA TRACKER // RADAR MODULE
            </h1>
            <span className="text-[#33ff33]/40 text-xs">v0.1</span>
          </div>
          
          <div className="flex items-center gap-4 text-[#33ff33]/60 text-xs">
            <span className="flex items-center gap-2">
              <span className="animate-pulse">●</span>
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Corner decorations - terminal style */}
      <div className="absolute top-12 left-4 text-[#33ff33]/30 font-mono text-xs z-20 pointer-events-none" style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.5)' }}>
        ┌──
      </div>
      <div className="absolute top-12 right-4 text-[#33ff33]/30 font-mono text-xs z-20 pointer-events-none" style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.5)' }}>
        ──┐
      </div>
      <div className="absolute bottom-4 left-4 text-[#33ff33]/30 font-mono text-xs z-20 pointer-events-none" style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.5)' }}>
        └──
      </div>
      <div className="absolute bottom-4 right-4 text-[#33ff33]/30 font-mono text-xs z-20 pointer-events-none" style={{ textShadow: '0 0 5px rgba(51, 255, 51, 0.5)' }}>
        ──┘
      </div>
    </div>
  )
}
