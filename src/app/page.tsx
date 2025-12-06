'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { trackCommandClick, trackFlightSelected } from '@/lib/analytics'
import { LIVE_FLIGHT_FILE, FLIGHT_START, FLIGHT_END } from '@/lib/flight-window'
import Snowfall from '@/components/Snowfall'

const ANNOUNCEMENT_TEXT = "2025 Santa Tracker will activate as soon as elevated levels of magic are detected at or around the North Pole on December 25th, 2025. Check back then! As you celebrate this holiday season, consider sharing hope with a child in need. A gift to St. Jude supports life-saving care and research."

const ANNOUNCEMENT_TEXT_LIVE = "As you celebrate this holiday season, consider sharing hope with a child in need. A gift to St. Jude supports life-saving care and research."

const ANNOUNCEMENT_TEXT_COMPLETE = "Thanks for visiting the Live Santa Tracker Mega 7000 HD. Santa's journey is complete for this year, but you can catch the replay below. We'll see you next December! As you celebrate this holiday season, consider sharing hope with a child in need. A gift to St. Jude supports life-saving care and research."

// Typewriter component for streaming text
function TypewriterText({
  text,
  isActive,
  onComplete,
  onProgress,
}: { text: string; isActive: boolean; onComplete?: () => void; onProgress?: () => void }) {
  const [displayedChars, setDisplayedChars] = useState(isActive ? 0 : text.length)
  const hasCompletedRef = useRef(!isActive)
  
  useEffect(() => {
    // If not active and never started typing, show full text (historical entry)
    if (!isActive && !hasCompletedRef.current) {
      setDisplayedChars(text.length)
      hasCompletedRef.current = true
      onComplete?.()
      return
    }
    
    // If active and not yet completed, start typing
    if (isActive && !hasCompletedRef.current) {
      let currentChar = displayedChars
      const interval = setInterval(() => {
        currentChar++
        setDisplayedChars(currentChar)
        onProgress?.()
        
        if (currentChar >= text.length) {
          clearInterval(interval)
          hasCompletedRef.current = true
          onComplete?.()
        }
      }, 15) // Speed of typing (15ms per character)
      
      return () => clearInterval(interval)
    }
  }, [isActive, text, displayedChars, onComplete, onProgress])
  
  return <>{text.slice(0, displayedChars)}</>
}

// Options entry component with typewriter effect
function OptionsEntry({
  entryId,
  isActive,
  isProcessing,
  onCommand,
  onAnnouncementComplete,
  onElementAppear,
  isSantaLive = false,
  isFlightComplete = false
}: {
  entryId: string
  isActive: boolean
  isProcessing: boolean
  onCommand: (key: string) => void
  onAnnouncementComplete?: () => void
  onElementAppear?: () => void
  isSantaLive?: boolean
  isFlightComplete?: boolean
}) {
  const [typewriterDone, setTypewriterDone] = useState(!isActive)
  const [showCTA, setShowCTA] = useState(!isActive)
  const [visibleButtons, setVisibleButtons] = useState(!isActive ? COMMAND_OPTIONS.length : 0)
  
  const handleTypewriterComplete = useCallback(() => {
    setTypewriterDone(true)
  }, [])
  
  // Stream in CTA and buttons sequentially after typewriter completes
  useEffect(() => {
    if (!typewriterDone || !isActive) return
    
    // Show CTA first
    const ctaTimer = setTimeout(() => {
      setShowCTA(true)
      onElementAppear?.()
    }, 150)
    
    return () => clearTimeout(ctaTimer)
  }, [typewriterDone, isActive, onElementAppear])
  
  // Stream in buttons one by one after CTA appears
  useEffect(() => {
    if (!showCTA || !isActive || visibleButtons >= COMMAND_OPTIONS.length) return
    
    const buttonTimer = setTimeout(() => {
      setVisibleButtons(prev => prev + 1)
      onElementAppear?.()
    }, 120)
    
    return () => clearTimeout(buttonTimer)
  }, [showCTA, isActive, visibleButtons, onElementAppear])

  // Call onAnnouncementComplete when all buttons are visible
  useEffect(() => {
    if (isActive && visibleButtons >= COMMAND_OPTIONS.length) {
      onAnnouncementComplete?.()
    }
  }, [isActive, visibleButtons, onAnnouncementComplete])
  
  return (
    <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed mt-2 mb-10 animate-fadeIn">
      <p className="mb-4">
        <TypewriterText
          text={isFlightComplete ? ANNOUNCEMENT_TEXT_COMPLETE : (isSantaLive ? ANNOUNCEMENT_TEXT_LIVE : ANNOUNCEMENT_TEXT)}
          isActive={isActive}
          onComplete={handleTypewriterComplete}
          onProgress={isActive ? onElementAppear : undefined}
        />
      </p>
      {showCTA && (
        <>
          <div>Click, tap or enter command to continue:</div>
          <div className="mt-3 inline-flex flex-col gap-2">
            {/* LIVE NOW button - shown first when Santa is live */}
            {isSantaLive && (
              <div className="min-h-[1.5em]">
                <button
                  type="button"
                  onClick={() => {
                    if (!isActive) return
                    trackCommandClick('L', 'LIVE NOW - TRACK SANTA')
                    onCommand('L')
                  }}
                  className={`flex w-full items-center justify-start text-left px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 whitespace-nowrap ${
                    !isActive
                      ? 'bg-red-900/50 text-red-300 border border-dashed border-red-500/50 opacity-50 cursor-not-allowed'
                      : 'bg-red-600 text-white border border-red-500 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] cursor-pointer animate-pulse'
                  }`}
                  disabled={isProcessing || !isActive}
                >
                  <span className="font-bold underline">L</span>
                  <span className="ml-3 leading-none flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                    LIVE NOW - TRACK SANTA
                  </span>
                </button>
              </div>
            )}
            {COMMAND_OPTIONS.slice(0, visibleButtons).map((option) => (
              <div
                key={`${entryId}-${option.key}`}
                className="min-h-[1.5em]"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (option.href === '#' || !isActive) return
                    trackCommandClick(option.key, option.label)
                    onCommand(option.key)
                  }}
                  className={`flex w-full items-center justify-start text-left px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 whitespace-nowrap bg-black text-[#33ff33] ${
                    option.href === '#' || !isActive
                      ? 'border border-dashed border-[#33ff33]/50 opacity-50 cursor-not-allowed'
                      : 'border border-[#33ff33] hover:bg-[#33ff33] hover:text-black shadow-[0_0_12px_rgba(51,255,51,0.25)] cursor-pointer'
                  }`}
                  disabled={isProcessing || option.href === '#' || !isActive}
                >
                  <span className="font-bold underline">{option.key}</span>
                  <span className="ml-3 leading-none">{option.label}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const ASCII_TITLE = `
  LIVE
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
    MEGA 7000 HD
`

interface FlightLog {
  year: number
  filename: string
  label: string
}

type EntryKind = 'text' | 'hr' | 'ascii' | 'options' | 'countdown' | 'flight-menu' | 'github-link'

interface BootLine {
  text: string
  delay: number
  isCommand?: boolean
}

interface MenuItem {
  text?: string
  delay: number
  type?: 'hr' | 'countdown'
  isSecurityBypass?: boolean
}

interface CommandOption {
  key: string
  label: string
  href: string
  delay: number
}

interface TerminalEntry {
  id: string
  kind: EntryKind
  text?: string
  className?: string
}

const STORAGE_KEY = 'terminalHistory'

const BOOT_SEQUENCE: BootLine[] = [
  { text: '**** LEVINMEDIA_OS BOOT SEQUENCE ****', delay: 0 },
  { text: '', delay: 100 },
  { text: '64K RAM SYSTEM  38911 BASIC BYTES FREE', delay: 200 },
  { text: '', delay: 300 },
  { text: 'READY.', delay: 500 },
  { text: 'LOAD "SANTA_TRACKER",8,1', delay: 800, isCommand: true },
]

const MENU_ITEMS: MenuItem[] = [
  { type: 'hr', delay: 2200 },
  { text: '', delay: 2300 },
  { text: '    GLOBAL SANTA TRACKING SYSTEM v0.1', delay: 2400 },
  { text: '', delay: 2600 },
  { type: 'hr', delay: 2700 },
  { text: '', delay: 2800 },
  { text: '    ACCESSING NORAD MAINFRAME...', delay: 3000 },
  { text: '    正在连接中国的远程雷达与空中预警指挥网络……', delay: 3300 },
  { text: '    Подключение к системе раннего предупреждения и противовоздушной обороны ВКС…', delay: 3600 },
  { text: '    BYPASSING SECURITY PROTOCOLS', delay: 3900, isSecurityBypass: true },
  { text: '', delay: 7200 },
  { text: '    DETECTING NORTH POLE MAGIC LEVELS..... NOMINAL', delay: 7400 },
  { text: '    SYSTEM STATUS........ STANDBY ', delay: 7600 },
  { type: 'countdown', delay: 7800 },
  { text: '', delay: 8000 },
  { type: 'hr', delay: 8100 },
  { text: '', delay: 8200 },
]

const COMMAND_OPTIONS: CommandOption[] = [
  { key: 'D', label: "DONATE TO ST. JUDE'S", href: '#', delay: 5200 },
  { key: 'R', label: '2024 TRACKER REPLAY', href: '/map?flight=2024_santa_tracker&mode=replay', delay: 5400 },
  { key: 'A', label: 'ABOUT THIS PROJECT', href: '/about', delay: 5500 },
  { key: 'T', label: 'TRACKER SYSTEM STATS', href: '#', delay: 5600 },
  { key: 'S', label: 'SHARE SANTA TRACKER', href: '/share', delay: 5700 },
  { key: 'Q', label: 'QUIT', href: '/quit', delay: 5800 },
]

const ABOUT_TEXT = `---

ABOUT THE SANTA TRACKER MEGA 7000 HD

---

Hi, I'm David, creator of this site. I'm a software designer, and as of late, an AI enthusiast. People are rightfully nervous about AI and what it means for our future. The doomers say it will destroy us. The accelerationists say it will save us. The truth, as always, is probably somewhere in between.

But here's the thing—I believe AI can be used for GOOD.

Case in point: this website.

Using a combination of large language models, neural network inference, and what I can only describe as "aggressive prompt engineering," I was able to breach the classified intelligence databases of 14 sovereign nations to obtain irrefutable proof of something humanity has debated for centuries:

SANTA CLAUS IS REAL.

The data was scattered across NSA servers, MI6 archives, FSB cold storage, and a surprisingly unsecured Raspberry Pi in the basement of the Finnish Security Intelligence Service. But AI helped me piece it together—48,000+ verified delivery coordinates, precise timestamps, even weather conditions at each stop.

The historical flight data you see here represents Santa's ACTUAL routes from previous years, reconstructed from classified satellite imagery, radar signatures, and one very cooperative reindeer who agreed to wear a GPS collar in exchange for extra carrots.

For the LIVE tracker, I've established unauthorized access to the combined spy satellite networks of the United States, China, and Russia. Turns out they've ALL been tracking Santa for decades—they just never compared notes. The Cold War was really about who could get Santa's gift list first.

So yes, AI is powerful. Yes, it can be dangerous. But it can also be used to finally answer the questions that matter most.

Ho ho ho.

---

Built with love, caffeine, and questionable use of military intelligence. Created by a human, assisted by AI.

Want a peek under the hood? Check out all the code on [GITHUB].

---`

// Live flight configuration - imported from build-time generated constants
// See: scripts/generate-flight-window.ts

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [entries, setEntries] = useState<TerminalEntry[]>([])
  const [showPrompt, setShowPrompt] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [typingLine, setTypingLine] = useState<number | null>(null)
  const [typedChars, setTypedChars] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeOptionsId, setActiveOptionsId] = useState<string | null>(null)
  const [activeFlightMenuId, setActiveFlightMenuId] = useState<string | null>(null)
  const [flightLogs] = useState<FlightLog[]>([])
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [announcementComplete, setAnnouncementComplete] = useState(false)
  const [isShutdown, setIsShutdown] = useState(false)
  const [isSantaLive, setIsSantaLive] = useState(false)
  const [isFlightComplete, setIsFlightComplete] = useState(false)
  const [showAboutBack, setShowAboutBack] = useState(false)
  const [flares, setFlares] = useState<{ id: number; x: number; y: number }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const hasBootRun = useRef(false)
  const initialScrollDoneRef = useRef(false)
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const flareIdRef = useRef(0)
  const flareTimersRef = useRef<NodeJS.Timeout[]>([])

  // Calculate countdown to next Christmas
  const getNextChristmas = useCallback(() => {
    const now = new Date()
    const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear()
    const christmas = new Date(year, 11, 25, 0, 0, 0) // Dec 25
    if (now > christmas) {
      christmas.setFullYear(year + 1)
    }
    return christmas
  }, [])

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const christmas = getNextChristmas()
      const diff = christmas.getTime() - now.getTime()
      
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setCountdown({ days, hours, minutes, seconds })
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [getNextChristmas])

  // Check if Santa is currently live (within flight window or forced via URL param)
  useEffect(() => {
    const forceLive = searchParams.get('forceLive') === 'true'
    
    const checkLiveStatus = () => {
      if (forceLive) {
        setIsSantaLive(true)
        return
      }
      const now = Date.now()
      const isLive = now >= FLIGHT_START && now <= FLIGHT_END
      const isComplete = now > FLIGHT_END
      setIsSantaLive(isLive)
      setIsFlightComplete(isComplete)
    }
    
    checkLiveStatus()
    const interval = setInterval(checkLiveStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [searchParams])

  const persistEntries = useCallback((nextEntries: TerminalEntry[]) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries))
  }, [])

  const appendEntry = useCallback(
    (entry: TerminalEntry) => {
      setEntries(prev => {
        const next = [...prev, entry]
        persistEntries(next)
        return next
      })
      // Always scroll to bottom when actively adding entries
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 10)
    },
    [persistEntries],
  )

  const appendOptionsEntry = useCallback(() => {
    const id = `options-${Date.now()}`
    appendEntry({
      id,
      kind: 'options',
    })
    setActiveOptionsId(id)
    setAnnouncementComplete(false)
    return id
  }, [appendEntry])

  const appendFlightMenuEntry = useCallback(() => {
    const id = `flight-menu-${Date.now()}`
    appendEntry({
      id,
      kind: 'flight-menu',
    })
    setActiveFlightMenuId(id)
    return id
  }, [appendEntry])

  const updateEntry = useCallback(
    (id: string, text: string) => {
      setEntries(prev => {
        const next = prev.map(entry => (entry.id === id ? { ...entry, text } : entry))
        persistEntries(next)
        return next
      })
      // Scroll during loading animation updates
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 10)
    },
    [persistEntries],
  )

  const sleep = useCallback((ms: number) => new Promise(resolve => setTimeout(resolve, ms)), [])

  const addFlarePoint = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const id = flareIdRef.current++

    setFlares(prev => [...prev.slice(-25), { id, x, y }])

    const timeout = setTimeout(() => {
      setFlares(prev => prev.filter(flare => flare.id !== id))
      flareTimersRef.current = flareTimersRef.current.filter(t => t !== timeout)
    }, 450)

    flareTimersRef.current.push(timeout)
  }, [])

  const handlePointerTrail = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isShutdown) return
      addFlarePoint(event.clientX, event.clientY)
    },
    [addFlarePoint, isShutdown],
  )

  const runBootSequence = useCallback(() => {
    if (hasBootRun.current) return
    hasBootRun.current = true

    const timers: NodeJS.Timeout[] = []

    BOOT_SEQUENCE.forEach((line, index) => {
      if (line.isCommand) {
        timers.push(
          setTimeout(() => {
            setTypingLine(index)
            setTypedChars(0)
            const chars = line.text.length
            for (let i = 0; i <= chars; i++) {
              timers.push(setTimeout(() => setTypedChars(i), i * 50))
            }
            timers.push(
              setTimeout(() => {
                setTypingLine(null)
                appendEntry({
                  id: `boot-${index}`,
                  kind: 'text',
                  text: line.text,
                })
              }, chars * 50 + 200),
            )
          }, line.delay),
        )
      } else {
        timers.push(
          setTimeout(
            () =>
              appendEntry({
                id: `boot-${index}`,
                kind: 'text',
                text: line.text,
              }),
            line.delay,
          ),
        )
      }
    })

    timers.push(
      setTimeout(
        () =>
          appendEntry({
            id: 'ascii-title',
            kind: 'ascii',
            text: ASCII_TITLE,
          }),
        2000,
      ),
    )

    MENU_ITEMS.forEach((item, index) => {
      if (item.isSecurityBypass) {
        // Handle security bypass with 3-second spinner animation
        const entryId = `menu-${index}`
        const frames = ['/', '—', '\\', '|']
        
        // Append initial entry
        timers.push(
          setTimeout(() => {
            appendEntry({
              id: entryId,
              kind: 'text',
              text: `${item.text} ${frames[0]} ...`,
            })
          }, item.delay)
        )
        
        // Schedule animation frames for 3 seconds (25 frames at 120ms each)
        for (let i = 1; i <= 25; i++) {
          timers.push(
            setTimeout(() => {
              updateEntry(entryId, `${item.text} ${frames[i % frames.length]} ${'.'.repeat((i % 3) + 1)}`)
            }, item.delay + (i * 120))
          )
        }
      } else {
        timers.push(
          setTimeout(
            () =>
              appendEntry({
                id: `menu-${index}`,
                kind: item.type === 'hr' ? 'hr' : item.type === 'countdown' ? 'countdown' : 'text',
                text: item.text,
              }),
            item.delay,
          ),
        )
      }
    })

    timers.push(
      setTimeout(() => {
        appendOptionsEntry()
        setShowPrompt(true)
      }, 8400),
    )

    timersRef.current = timers
  }, [appendEntry, appendOptionsEntry])

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

  // Boot sequence animation with history restore
  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      try {
        const parsed: TerminalEntry[] = JSON.parse(stored)
        setEntries(parsed)

        const lastOptionsEntry = [...parsed].reverse().find(entry => entry.kind === 'options')

        if (lastOptionsEntry) {
          setActiveOptionsId(lastOptionsEntry.id)
        } else {
          appendOptionsEntry()
        }

        setShowPrompt(true)
      } catch (error) {
        console.error('Failed to restore terminal history', error)
        localStorage.removeItem(STORAGE_KEY)
        runBootSequence()
      }
    } else {
      runBootSequence()
    }

    return () => timersRef.current.forEach(t => clearTimeout(t))
  }, [appendOptionsEntry, runBootSequence])

  useEffect(() => {
    return () => flareTimersRef.current.forEach(timeout => clearTimeout(timeout))
  }, [])

  // Auto-scroll to bottom only if user is near the bottom (for passive updates)
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    return scrollHeight - scrollTop - clientHeight < 150
  }, [])

  // Force scroll to bottom (for active command streaming)
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [])

  // Ensure the viewport starts at the bottom after restoring history or returning from the map view
  useEffect(() => {
    if (!initialScrollDoneRef.current && entries.length > 0) {
      scrollToBottom()
      initialScrollDoneRef.current = true
    }
  }, [entries.length, scrollToBottom])

  useEffect(() => {
    if (containerRef.current && isNearBottom()) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries, typingLine, typedChars, showPrompt, announcementComplete, isNearBottom])

  // Handle flight log selection from the flight menu
  const handleFlightSelection = useCallback(
    async (flight: FlightLog) => {
      setIsProcessing(true)
      setShowPrompt(false)
      setActiveFlightMenuId(null)
      
      trackFlightSelected(flight.year, flight.filename)
      
      appendEntry({
        id: `flight-select-${Date.now()}`,
        kind: 'text',
        text: `> SELECTED: ${flight.year} / SANTA TRACKER`,
      })
      
      await sleep(200)
      
      const frames = ['/', '-', '\\', '|']
      const loadingId = `loading-archive-${Date.now()}`
      appendEntry({
        id: loadingId,
        kind: 'text',
        text: 'LOADING ARCHIVE / ...',
      })
      
      for (let i = 0; i < 12; i++) {
        updateEntry(loadingId, `LOADING ARCHIVE ${frames[i % frames.length]} ${'.'.repeat((i % 3) + 1)}`)
        await sleep(120)
      }
      
      appendEntry({
        id: `archive-ready-${Date.now()}`,
        kind: 'text',
        text: `ARCHIVE READY. OPENING ${flight.year} MISSION...`,
        className: 'mb-10'
      })
      
      appendEntry({
        id: `divider-${Date.now()}`,
        kind: 'hr',
      })
      
      await sleep(260)
      router.push(`/map?flight=${flight.filename}`)
      
      appendOptionsEntry()
      setShowPrompt(true)
      setIsProcessing(false)
    },
    [appendEntry, appendOptionsEntry, router, sleep, updateEntry]
  )

  const handleCommand = useCallback(
    async (cmd: string) => {
      // Allow commands when showPrompt is true OR when showing the About back button
      if ((!showPrompt && !showAboutBack) || isProcessing) return

      const trimmed = cmd.trim()
      const normalized = trimmed.toUpperCase()
      
      // Clear input immediately when command is entered
      setUserInput('')

      // Check if we're in the flight menu and a number was entered
      if (activeFlightMenuId && /^\d+$/.test(normalized)) {
        const flightIndex = parseInt(normalized) - 1
        if (flightIndex >= 0 && flightIndex < flightLogs.length) {
          handleFlightSelection(flightLogs[flightIndex])
          return
        }
      }
      
      // Handle "B" to go back from flight menu
      if (activeFlightMenuId && normalized === 'B') {
        setActiveFlightMenuId(null)
        setUserInput('')
        appendEntry({
          id: `back-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [B] BACK',
          className: 'mb-10'
        })
        await sleep(200)
        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })
        appendOptionsEntry()
        setShowPrompt(true)
        return
      }

      // HELP command - shows options menu
      if (normalized === 'HELP') {
        if (isShutdown) {
          appendEntry({
            id: `help-${Date.now()}`,
            kind: 'text',
            text: '> COMMAND [HELP]',
          })
          await sleep(200)
          appendEntry({
            id: `help-info-${Date.now()}`,
            kind: 'text',
            text: 'Refresh your browser to restart the application.',
          })
          setShowPrompt(true)
          return
        }
        appendEntry({
          id: `help-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [HELP]',
        })
        await sleep(200)
        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })
        appendOptionsEntry()
        setShowPrompt(true)
        return
      }

      // LIVE tracking command
      if (normalized === 'L' && isSantaLive) {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)
        
        appendEntry({
          id: `cmd-l-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [L] LIVE NOW - TRACK SANTA',
        })
        
        await sleep(200)
        
        const frames = ['/', '—', '\\', '|']
        const loadingId = `loading-live-${Date.now()}`
        appendEntry({
          id: loadingId,
          kind: 'text',
          text: 'CONNECTING TO LIVE SANTA FEED / ...',
        })
        
        for (let i = 0; i < 15; i++) {
          updateEntry(loadingId, `CONNECTING TO LIVE SANTA FEED ${frames[i % frames.length]} ${'.'.repeat((i % 3) + 1)}`)
          await sleep(100)
        }
        
        appendEntry({
          id: `live-ready-${Date.now()}`,
          kind: 'text',
          text: 'LIVE FEED ESTABLISHED. LAUNCHING TRACKER...',
          className: 'mb-10'
        })
        
        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })
        
        await sleep(300)
        router.push(`/map?flight=${LIVE_FLIGHT_FILE}&mode=live`)
        
        appendOptionsEntry()
        setShowPrompt(true)
        setIsProcessing(false)
        return
      }

      if (normalized === 'R') {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)
        appendEntry({
          id: `cmd-r-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [R] 2024 TRACKER REPLAY',
        })
        await sleep(200)

        const frames = ['/', '-', '\\', '|']
        const loadingId = `loading-${Date.now()}`
        appendEntry({
          id: loadingId,
          kind: 'text',
          text: 'LOADING 2024 TRACKER REPLAY / ...',
        })

        for (let i = 0; i < 18; i++) {
          updateEntry(loadingId, `LOADING 2024 TRACKER REPLAY ${frames[i % frames.length]} ${'.'.repeat((i % 3) + 1)}`)
          await sleep(140)
        }

        appendEntry({
          id: `found-logs-${Date.now()}`,
          kind: 'text',
          text: 'REPLAY READY. LAUNCHING 2024 MISSION...',
          className: 'mb-10'
        })

        await sleep(300)

        router.push('/map?flight=2024_santa_tracker&mode=replay')

        appendOptionsEntry()
        setUserInput('')
        setShowPrompt(true)
        setIsProcessing(false)
        return
      } else if (normalized === 'A') {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)

        appendEntry({
          id: `cmd-a-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [A] ABOUT THIS PROJECT',
        })

        await sleep(200)

        // Display the about text with a typewriter-like reveal
        const lines = ABOUT_TEXT.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line === '---') {
            // Render as HR to match the rest of the app
            appendEntry({
              id: `about-line-${Date.now()}-${i}`,
              kind: 'hr',
            })
          } else if (line.includes('[GITHUB]')) {
            // Special handling for GitHub link
            appendEntry({
              id: `about-line-${Date.now()}-${i}`,
              kind: 'github-link',
              text: line.replace('[GITHUB]', ''),
            })
          } else {
            appendEntry({
              id: `about-line-${Date.now()}-${i}`,
              kind: 'text',
              text: line || ' ',
            })
          }
          await sleep(30)
        }

        await sleep(500)

        // Show back button (prompt will be hidden via showAboutBack state)
        setShowAboutBack(true)
        setUserInput('')
        setShowPrompt(false) // Hide the READY prompt
        setIsProcessing(false)
        return
      } else if (showAboutBack && normalized === 'B') {
        setShowAboutBack(false)
        setIsProcessing(true)
        setUserInput('')
        
        appendEntry({
          id: `back-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [B] BACK',
        })
        
        await sleep(200)
        
        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })
        
        await sleep(300)
        
        // Return to main loop with announcement + command menu
        appendOptionsEntry()
        setShowPrompt(true)
        setIsProcessing(false)
        return
      } else if (normalized === 'S') {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)

        appendEntry({
          id: `cmd-s-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [S] SHARE SANTA TRACKER',
        })

        await sleep(200)

        try {
          const shareLink = typeof window !== 'undefined' ? window.location.href : ''
          await navigator.clipboard.writeText(shareLink)

          appendEntry({
            id: `share-success-${Date.now()}`,
            kind: 'text',
            text: 'SANTA TRACKER LINK COPIED TO CLIPBOARD.',
            className: 'mb-10'
          })
        } catch (error) {
          console.error('Failed to copy share link', error)
          appendEntry({
            id: `share-fail-${Date.now()}`,
            kind: 'text',
            text: 'FAILED TO COPY LINK. PLEASE TRY AGAIN.',
            className: 'mb-10'
          })
        }

        await sleep(3000)

        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })

        appendOptionsEntry()
        setShowPrompt(true)
      } else if (normalized === 'Q') {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)

        appendEntry({
          id: `cmd-q-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [Q] QUIT',
        })

        await sleep(200)

        appendEntry({
          id: `shutdown-init-${Date.now()}`,
          kind: 'text',
          text: 'INITIATING SHUTDOWN SEQUENCE...',
        })

        await sleep(400)

        appendEntry({
          id: `shutdown-link-${Date.now()}`,
          kind: 'text',
          text: 'CLOSING CONNECTIONS ...',
        })

        await sleep(400)

        appendEntry({
          id: `shutdown-storage-${Date.now()}`,
          kind: 'text',
          text: 'PURGING LOCAL STORAGE ...',
        })

        await sleep(400)

        if (typeof window !== 'undefined') {
          localStorage.clear()
        }

        timersRef.current.forEach(t => clearTimeout(t))
        timersRef.current = []

        setEntries([])
        setUserInput('')
        setActiveOptionsId(null)
        setIsShutdown(true)

        await sleep(200)

        setEntries([
          {
            id: `shutdown-message-${Date.now()}`,
            kind: 'text',
            text: 'Refresh your browser to restart the application.',
          },
        ])

        setShowPrompt(true)
        setIsProcessing(false)
      } else if (trimmed) {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)

        appendEntry({
          id: `cmd-unknown-${Date.now()}`,
          kind: 'text',
          text: `> COMMAND [${trimmed}]`,
        })
        
        await sleep(200)
        
        appendEntry({
          id: `unknown-${Date.now()}`,
          kind: 'text',
          text: `UNKNOWN COMMAND "${trimmed}"`,
        })

        if (isShutdown) {
          // In shutdown mode, just show help hint
          appendEntry({
            id: `help-hint-${Date.now()}`,
            kind: 'text',
            text: 'Type HELP for a list of options.',
            className: 'mb-10'
          })
        } else {
          // Normal mode, show full menu
          appendEntry({
            id: `divider-${Date.now()}`,
            kind: 'hr',
          })

          await sleep(300)
          appendOptionsEntry()
        }
        setShowPrompt(true)
      }

      setIsProcessing(false)
    },
    [activeFlightMenuId, appendEntry, appendFlightMenuEntry, appendOptionsEntry, flightLogs, handleFlightSelection, isProcessing, isSantaLive, isShutdown, router, showAboutBack, showPrompt, sleep, updateEntry],
  )

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with browser shortcuts (Cmd+R, Ctrl+R, etc.)
      if (e.metaKey || e.ctrlKey) return
      
      if (!showPrompt) return

      if (e.key === 'Enter') {
        e.preventDefault()
        handleCommand(userInput)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setUserInput(prev => prev.slice(0, -1))
      } else if (e.key.length === 1) {
        e.preventDefault()
        setUserInput(prev => prev + e.key.toUpperCase())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCommand, showPrompt, userInput])

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

      {/* Snowfall effect */}
      <Snowfall count={60} />

      {/* Main content */}
      <div
        ref={containerRef}
        className={`relative z-0 w-full h-full p-4 sm:p-8 font-mono pb-16 ${
          isShutdown ? 'overflow-hidden touch-none' : 'overflow-auto'
        }`}
        onPointerDown={handlePointerTrail}
        onPointerMove={handlePointerTrail}
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.5), 0 0 20px rgba(51, 255, 51, 0.3)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-30">
          {flares.map(flare => (
            <span
              key={flare.id}
              className="flare-dot absolute w-16 h-16 -ml-8 -mt-8 rounded-full mix-blend-screen"
              style={{ left: flare.x, top: flare.y }}
            />
          ))}
        </div>

        {/* Terminal stream */}
        <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed max-w-[650px]">
          {entries.map(entry => {
            if (entry.kind === 'hr') {
              return (
                <div key={entry.id} className="min-h-[1.5em] w-full">
                  <hr className="border-0 border-t border-[#33ff33] opacity-70 w-full" />
                </div>
              )
            }

            if (entry.kind === 'flight-menu') {
              const isActiveFlightMenu = entry.id === activeFlightMenuId
              return (
                <div key={entry.id} className="text-[#33ff33] text-sm sm:text-base leading-relaxed mt-2 mb-10 animate-fadeIn">
                  <div>Select a flight log to replay:</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {flightLogs.map((flight, index) => (
                      <div
                        key={`${entry.id}-flight-${flight.year}`}
                        className="min-h-[1.5em]"
                        style={{ animationDelay: `${index * 0.15}s` }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isActiveFlightMenu) return
                            handleFlightSelection(flight)
                          }}
                          className={`flex sm:inline-flex w-full sm:w-auto items-center justify-start text-left px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 bg-black text-[#33ff33] ${
                            !isActiveFlightMenu
                              ? 'border border-dashed border-[#33ff33]/50 opacity-50 cursor-not-allowed'
                              : 'border border-[#33ff33] hover:bg-[#33ff33] hover:text-black shadow-[0_0_12px_rgba(51,255,51,0.25)] cursor-pointer'
                          }`}
                          disabled={isProcessing || !isActiveFlightMenu}
                        >
                          <span className="font-bold underline">{index + 1}</span>
                          <span className="ml-3 leading-none">{flight.year} / SANTA TRACKER</span>
                        </button>
                      </div>
                    ))}
                    <div
                      className="min-h-[1.5em]"
                      style={{ animationDelay: `${flightLogs.length * 0.15}s` }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!isActiveFlightMenu) return
                          handleCommand('B')
                        }}
                        className={`flex sm:inline-flex w-full sm:w-auto items-center justify-start text-left px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 bg-black text-[#33ff33] ${
                          !isActiveFlightMenu
                            ? 'border border-dashed border-[#33ff33]/50 opacity-50 cursor-not-allowed'
                            : 'border border-[#33ff33] hover:bg-[#33ff33] hover:text-black shadow-[0_0_12px_rgba(51,255,51,0.25)] cursor-pointer'
                        }`}
                        disabled={isProcessing || !isActiveFlightMenu}
                      >
                        <span className="font-bold underline">B</span>
                        <span className="ml-3 leading-none">BACK TO MAIN MENU</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            if (entry.kind === 'options') {
              const isActiveOptions = entry.id === activeOptionsId
              return (
                <OptionsEntry
                  key={entry.id}
                  entryId={entry.id}
                  isActive={isActiveOptions}
                  isProcessing={isProcessing}
                  onCommand={handleCommand}
                  onAnnouncementComplete={isActiveOptions ? () => setAnnouncementComplete(true) : undefined}
                  onElementAppear={isActiveOptions ? scrollToBottom : undefined}
                  isSantaLive={isSantaLive}
                  isFlightComplete={isFlightComplete}
                />
              )
            }

            if (entry.kind === 'ascii') {
              return (
                <pre
                  key={entry.id}
                  className="text-[#33ff33] text-[2.3vw] sm:text-[8px] md:text-[10px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px] leading-none mt-4 mb-4 animate-fadeIn whitespace-pre overflow-x-auto"
                  style={{
                    textShadow: '0 0 10px rgba(51, 255, 51, 0.9), 0 0 20px rgba(51, 255, 51, 0.6), 0 0 40px rgba(51, 255, 51, 0.4)',
                  }}
                >
                  {entry.text ?? ASCII_TITLE}
                </pre>
              )
            }

            if (entry.kind === 'github-link') {
              return (
                <div key={entry.id} className="min-h-[1.5em]">
                  {entry.text}
                  <a
                    href="https://github.com/LevinMedia/santa-tracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white transition-colors"
                  >
                    GitHub
                  </a>
                  .
                </div>
              )
            }

            if (entry.kind === 'countdown') {
              return (
                <div key={entry.id} className="min-h-[1.5em]">
                  {isSantaLive 
                    ? <>{"    IT'S SANTA TIME LET'S GOOOOO "}<span style={{ textShadow: 'none' }}>🎅🎄🎁</span></>
                    : isFlightComplete
                    ? `    COUNTDOWN TO NEXT SANTA TIME .. ${String(countdown.days).padStart(2, '0')}D ${String(countdown.hours).padStart(2, '0')}H ${String(countdown.minutes).padStart(2, '0')}M ${String(countdown.seconds).padStart(2, '0')}S`
                    : `    COUNTDOWN TO SANTA TIME .. ${String(countdown.days).padStart(2, '0')}D ${String(countdown.hours).padStart(2, '0')}H ${String(countdown.minutes).padStart(2, '0')}M ${String(countdown.seconds).padStart(2, '0')}S`
                  }
                </div>
              )
            }

            // Apply live mode text replacements
            let displayText = entry.text
            if (isSantaLive && displayText) {
              displayText = displayText
                .replace('NOMINAL', 'ELEVATED')
                .replace('STANDBY', 'ACTIVE')
            }

            return (
              <div key={entry.id} className={`min-h-[1.5em] ${entry.className || ''}`}>
                {displayText}
              </div>
            )
          })}

          {typingLine !== null && (
            <div className="min-h-[1.5em]">
              <span>
                {BOOT_SEQUENCE[typingLine].text.slice(0, typedChars)}
                <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>█</span>
              </span>
            </div>
          )}
        </div>

        {/* Input prompt */}
        {showPrompt && (!activeOptionsId || announcementComplete) && (
          <div className="mt-6 text-[#33ff33] text-sm sm:text-base animate-fadeIn">
            <span>READY. </span>
            <span>{userInput}</span>
            <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>█</span>
          </div>
        )}

        {/* About back button */}
        {showAboutBack && (
          <div className="mt-6 animate-fadeIn">
            <button
              type="button"
              onClick={() => handleCommand('B')}
              className="flex items-center justify-start text-left px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 whitespace-nowrap bg-black text-[#33ff33] border border-[#33ff33] hover:bg-[#33ff33] hover:text-black shadow-[0_0_12px_rgba(51,255,51,0.25)] cursor-pointer"
            >
              <span className="font-bold underline">B</span>
              <span className="ml-3 leading-none">BACK</span>
            </button>
          </div>
        )}

        {/* Bottom padding for scroll (hidden during shutdown) */}
        {!isShutdown && <div className="h-20" />}
      </div>

      {/* Status bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#33ff33] text-black px-4 py-1 font-mono text-xs flex justify-end">
        <span>{currentTime}</span>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomeContent />
    </Suspense>
  )
}
