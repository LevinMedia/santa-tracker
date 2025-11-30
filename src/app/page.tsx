'use client'

// Santa Tracker v0.1 - Trigger redeploy

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

const ASCII_TITLE = `
 ███████╗ █████╗ ███╗   ██╗████████╗ █████╗ 
 ██╔════╝██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗
 ███████╗███████║██╔██╗ ██║   ██║   ███████║
 ╚════██║██╔══██║██║╚██╗██║   ██║   ██╔══██║
 ███████║██║  ██║██║ ╚████║   ██║   ██║  ██║
 ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
                                            
 ████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██████╗ 
 ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
    ██║   ██████╔╝███████║██║     █████╔╝ █████╗  ██████╔╝
    ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
    ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║
    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
`

interface BootLine {
  text: string
  delay: number
  isCommand?: boolean
}

interface MenuItem {
  text: string
  delay: number
}

interface CommandOption {
  key: string
  label: string
  href: string
  delay: number
}

const BOOT_SEQUENCE: BootLine[] = [
  { text: '**** NORTH POLE COMPUTING C64 ****', delay: 0 },
  { text: '', delay: 100 },
  { text: '64K RAM SYSTEM  38911 BASIC BYTES FREE', delay: 200 },
  { text: '', delay: 300 },
  { text: 'READY.', delay: 500 },
  { text: 'LOAD "SANTA_TRACKER",8,1', delay: 800, isCommand: true },
]

const MENU_ITEMS: MenuItem[] = [
  { text: '════════════════════════════════════════════════════', delay: 2200 },
  { text: '', delay: 2300 },
  { text: '    GLOBAL SANTA TRACKING SYSTEM v0.1', delay: 2400 },
  { text: '', delay: 2600 },
  { text: '════════════════════════════════════════════════════', delay: 2700 },
  { text: '', delay: 2800 },
  { text: '    Accessing NORAD mainframe...', delay: 3000 },
  { text: '    连接中国卫星网络...', delay: 3300 },
  { text: '    Подключение к российской системе...', delay: 3600 },
  { text: '    Bypassing security protocols...', delay: 3900 },
  { text: '', delay: 4200 },
  { text: '    SYSTEM STATUS........ STANDBY', delay: 4400 },
  { text: '    SANTA ACTIVITY....... NOT DETECTED', delay: 4600 },
  { text: '', delay: 4800 },
  { text: '════════════════════════════════════════════════════', delay: 4900 },
  { text: '', delay: 5000 },
]

const COMMAND_OPTIONS: CommandOption[] = [
  { key: '1', label: 'VIEW PREVIOUS FLIGHTS', href: '/map', delay: 5200 },
  { key: '2', label: 'SYSTEM DIAGNOSTICS', href: '#', delay: 5400 },
]

export default function Home() {
  const router = useRouter()
  const [visibleBootLines, setVisibleBootLines] = useState<number>(0)
  const [visibleMenuLines, setVisibleMenuLines] = useState<number>(0)
  const [showAscii, setShowAscii] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [typingLine, setTypingLine] = useState<number | null>(null)
  const [typedChars, setTypedChars] = useState(0)
  const [userInput, setUserInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(v => !v)
    }, 530)
    return () => clearInterval(interval)
  }, [])

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC')
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Boot sequence animation
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    // Animate boot sequence lines
    BOOT_SEQUENCE.forEach((line, index) => {
      if (line.isCommand) {
        // Typewriter effect for commands
        timers.push(setTimeout(() => {
          setTypingLine(index)
          setTypedChars(0)
          const chars = line.text.length
          for (let i = 0; i <= chars; i++) {
            timers.push(setTimeout(() => setTypedChars(i), i * 50))
          }
          timers.push(setTimeout(() => {
            setTypingLine(null)
            setVisibleBootLines(index + 1)
          }, chars * 50 + 200))
        }, line.delay))
      } else {
        timers.push(setTimeout(() => setVisibleBootLines(index + 1), line.delay))
      }
    })

    // Show ASCII art after LOAD command
    timers.push(setTimeout(() => setShowAscii(true), 2000))

    // Show menu items one by one
    MENU_ITEMS.forEach((item, index) => {
      timers.push(setTimeout(() => setVisibleMenuLines(index + 1), item.delay))
    })

    // Show command options
    timers.push(setTimeout(() => setShowOptions(true), 5200))

    // Show prompt
    timers.push(setTimeout(() => setShowPrompt(true), 5800))

    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [visibleBootLines, visibleMenuLines, showAscii, showOptions, showPrompt])

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPrompt) return
      
      if (e.key === 'Enter') {
        // Execute command
        const cmd = userInput.trim()
        if (cmd === '1') {
          router.push('/map')
        }
        setUserInput('')
      } else if (e.key === 'Backspace') {
        setUserInput(prev => prev.slice(0, -1))
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Only allow single character inputs (letters, numbers)
        setUserInput(prev => prev + e.key.toUpperCase())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPrompt, userInput, router])

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      {/* CRT screen curvature effect */}
      <div 
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 70%, rgba(0,0,0,0.4) 100%)',
          boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
        }}
      />

      {/* Scan lines */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.08]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.8) 2px, rgba(0, 0, 0, 0.8) 4px)',
        }}
      />

      {/* Green phosphor glow */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(51, 255, 51, 0.1) 0%, transparent 70%)',
        }}
      />

      {/* Flicker effect */}
      <div className="absolute inset-0 pointer-events-none z-10 animate-flicker opacity-[0.02] bg-white" />

      {/* Main content */}
      <div 
        ref={containerRef}
        className="relative z-0 w-full h-full overflow-auto p-4 sm:p-8 font-mono pb-16"
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.5), 0 0 20px rgba(51, 255, 51, 0.3)',
        }}
      >
        {/* Boot sequence */}
        <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed">
          {BOOT_SEQUENCE.slice(0, visibleBootLines).map((line, index) => (
            <div key={index} className="min-h-[1.5em]">
              {typingLine === index ? (
                <span>
                  {line.text.slice(0, typedChars)}
                  <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>█</span>
                </span>
              ) : (
                line.text
              )}
            </div>
          ))}
          
          {/* Show cursor while typing command */}
          {typingLine !== null && visibleBootLines === typingLine && (
            <div className="min-h-[1.5em]">
              <span>
                {BOOT_SEQUENCE[typingLine].text.slice(0, typedChars)}
                <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>█</span>
              </span>
            </div>
          )}
        </div>

        {/* ASCII Art Title */}
        {showAscii && (
          <pre 
            className="text-[#33ff33] text-[6px] sm:text-[8px] md:text-[10px] leading-none mt-4 mb-4 animate-fadeIn whitespace-pre overflow-x-auto"
            style={{
              textShadow: '0 0 10px rgba(51, 255, 51, 0.9), 0 0 20px rgba(51, 255, 51, 0.6), 0 0 40px rgba(51, 255, 51, 0.4)',
            }}
          >
            {ASCII_TITLE}
          </pre>
        )}

        {/* Menu Items */}
        {showAscii && (
          <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed">
            {MENU_ITEMS.slice(0, visibleMenuLines).map((item, index) => (
              <div key={index} className="min-h-[1.5em]">
                {item.text}
              </div>
            ))}
          </div>
        )}

        {/* Command Options */}
        {showOptions && (
          <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed mt-2">
            <div className="animate-fadeIn">
              ENTER COMMAND:
            </div>
            <div className="mt-2">
              {COMMAND_OPTIONS.map((option, index) => (
                <div 
                  key={option.key}
                  className="animate-fadeIn min-h-[1.5em]"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  {option.href !== '#' ? (
                    <Link 
                      href={option.href}
                      className="hover:bg-[#33ff33] hover:text-black transition-colors duration-100 inline-block px-1 -mx-1"
                    >
                      [{option.key}] {option.label}
                    </Link>
                  ) : (
                    <span className="opacity-50 cursor-not-allowed">
                      [{option.key}] {option.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Input prompt */}
        {showPrompt && (
          <div className="mt-6 text-[#33ff33] text-sm sm:text-base animate-fadeIn">
            <span>READY. </span>
            <span>{userInput}</span>
            <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>█</span>
          </div>
        )}

        {/* Bottom padding for scroll */}
        <div className="h-20" />
      </div>

      {/* Status bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#33ff33] text-black px-4 py-1 font-mono text-xs flex justify-end">
        <span>{currentTime}</span>
      </div>
    </div>
  )
}
