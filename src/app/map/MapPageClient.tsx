'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import the globe component to avoid SSR issues
const GlobeMap = dynamic(() => import('@/components/GlobeMap'), {
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

interface MapPageClientProps {
  flightParam: string
}

const FLIGHT_TITLES: Record<string, string> = {
  'test-flight-1': '2024 / SANTA TRACKER REPLAY',
}

export default function MapPageClient({ flightParam }: MapPageClientProps) {
  const router = useRouter()

  const flightLogName = useMemo(() => flightParam.replace(/\.csv$/, ''), [flightParam])
  const dataFile = `/${flightLogName}.csv`
  const flightLogTitle = useMemo(
    () => FLIGHT_TITLES[flightLogName] ?? flightLogName.replace(/-/g, ' '),
    [flightLogName]
  )

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
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 65, 0.5) 2px, rgba(0, 255, 65, 0.5) 4px)',
          }}
        />

        {/* Vertical scan lines */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0, 255, 65, 0.3) 4px, rgba(0, 255, 65, 0.3) 6px)',
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
            background:
              'linear-gradient(180deg, transparent 0%, rgba(0, 255, 65, 0.08) 40%, rgba(0, 255, 65, 0.15) 50%, rgba(0, 255, 65, 0.08) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* Globe container with scrubber */}
      <div className="absolute inset-0">
        <GlobeMap dataFile={dataFile} />
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
              className="text-[#33ff33]/80 hover:bg-[#33ff33] hover:text-black transition-colors text-xs px-2 py-1 border border-[#33ff33]/50 whitespace-nowrap"
            >
              [ESC] BACK
            </Link>
            <span className="text-[#33ff33]/30">│</span>
            <h1 className="text-[#33ff33] text-sm tracking-wider uppercase">{flightLogTitle}</h1>
          </div>
        </div>
      </header>
    </div>
  )
}
