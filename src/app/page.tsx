'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c1524] via-[#1a2744] to-[#0c1524]" />
      
      {/* Stars */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Snowflakes */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="snowflake absolute text-white/40 text-2xl"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${8 + Math.random() * 7}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4">
            <span className="text-accent-red">Santa</span>
            <span className="text-accent-snow"> Tracker</span>
          </h1>
          <p className="text-xl text-accent-snow/70 font-light tracking-wide">
            Follow Santa&apos;s magical journey around the world
          </p>
        </div>

        {/* Status Card */}
        <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-accent-gold">Live Status</h2>
            <span className="flex items-center gap-2 text-accent-red">
              <span className="w-2 h-2 bg-accent-red rounded-full" />
              No activity
            </span>
          </div>

          {/* Current Location Display */}
          <div className="mb-6">
            <label className="block text-sm text-accent-snow/60 mb-2">Current Location</label>
            <div className="w-full flex items-center bg-white/10 rounded-xl px-4 py-3">
              <span className="flex items-center gap-3">
                <span className="text-2xl">🎅</span>
                <span>North Pole</span>
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-3xl font-bold text-accent-gold">2.4B</div>
              <div className="text-sm text-accent-snow/60">Gifts Delivered</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-3xl font-bold text-accent-red">847M</div>
              <div className="text-sm text-accent-snow/60">Miles Traveled</div>
            </div>
          </div>

          {/* Action Button - Links to Map */}
          <Link
            href="/map"
            className="block w-full text-center bg-gradient-to-r from-accent-red to-accent-red/80 hover:from-accent-red/90 hover:to-accent-red/70 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-accent-red/20"
          >
            View Previous Flights
          </Link>
        </div>

        {/* Tech Stack Badge */}
        <div className="mt-12 flex items-center gap-3 text-sm text-accent-snow/40">
          <span>Built with</span>
          <span className="px-3 py-1 bg-white/5 rounded-full">Next.js</span>
          <span className="px-3 py-1 bg-white/5 rounded-full">Tailwind</span>
          <span className="px-3 py-1 bg-white/5 rounded-full">Headless UI</span>
          <span className="px-3 py-1 bg-white/5 rounded-full">Supabase</span>
        </div>
      </div>

    </div>
  )
}
