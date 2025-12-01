'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'

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

type EntryKind = 'text' | 'hr' | 'ascii' | 'options'

interface BootLine {
  text: string
  delay: number
  isCommand?: boolean
}

interface MenuItem {
  text?: string
  delay: number
  type?: 'hr'
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
  { text: '    Accessing NORAD mainframe...', delay: 3000 },
  { text: '    正在连接中国的远程雷达与空中预警指挥网络……', delay: 3300 },
  { text: '    Подключение к системе раннего предупреждения и противовоздушной обороны ВКС…', delay: 3600 },
  { text: '    Bypassing security protocols...', delay: 3900 },
  { text: '', delay: 4200 },
  { text: '    SYSTEM STATUS........ STANDBY', delay: 4400 },
  { text: '    SANTA ACTIVITY....... NOT DETECTED', delay: 4600 },
  { text: '', delay: 4800 },
  { type: 'hr', delay: 4900 },
  { text: '', delay: 5000 },
]

const COMMAND_OPTIONS: CommandOption[] = [
  { key: '1', label: 'VIEW PREVIOUS FLIGHTS', href: '/map', delay: 5200 },
  { key: '2', label: 'SYSTEM DIAGNOSTICS', href: '#', delay: 5400 },
]

export default function Home() {
  const router = useRouter()
  const [entries, setEntries] = useState<TerminalEntry[]>([])
  const [showPrompt, setShowPrompt] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [typingLine, setTypingLine] = useState<number | null>(null)
  const [typedChars, setTypedChars] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeOptionsId, setActiveOptionsId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasBootRun = useRef(false)
  const timersRef = useRef<NodeJS.Timeout[]>([])

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
    return id
  }, [appendEntry])

  const updateEntry = useCallback(
    (id: string, text: string) => {
      setEntries(prev => {
        const next = prev.map(entry => (entry.id === id ? { ...entry, text } : entry))
        persistEntries(next)
        return next
      })
    },
    [persistEntries],
  )

  const sleep = useCallback((ms: number) => new Promise(resolve => setTimeout(resolve, ms)), [])

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
      timers.push(
        setTimeout(
          () =>
            appendEntry({
              id: `menu-${index}`,
              kind: item.type === 'hr' ? 'hr' : 'text',
              text: item.text,
            }),
          item.delay,
        ),
      )
    })

    timers.push(
      setTimeout(() => {
        appendOptionsEntry()
        setShowPrompt(true)
      }, 5200),
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries, typingLine, typedChars, showPrompt])

  const handleCommand = useCallback(
    async (cmd: string) => {
      if (!showPrompt || isProcessing) return

      const trimmed = cmd.trim()

      if (trimmed === '1') {
        setIsProcessing(true)
        setShowPrompt(false)
        setActiveOptionsId(null)
        appendEntry({
          id: `cmd-1-${Date.now()}`,
          kind: 'text',
          text: '> COMMAND [1] VIEW PREVIOUS FLIGHTS',
        })
        await sleep(200)

        const frames = ['/', '-', '\\', '|']
        const loadingId = `loading-${Date.now()}`
        appendEntry({
          id: loadingId,
          kind: 'text',
          text: 'LOADING FLIGHT LOGS / ...',
        })

        for (let i = 0; i < 18; i++) {
          updateEntry(loadingId, `LOADING FLIGHT LOGS ${frames[i % frames.length]} ${'.'.repeat((i % 3) + 1)}`)
          await sleep(140)
        }

        appendEntry({
          id: `flight-available-${Date.now()}`,
          kind: 'text',
          text: 'AVAILABLE ARCHIVES: 2024 / SANTA GLOBAL RUN',
        })

        appendEntry({
          id: `ready-${Date.now()}`,
          kind: 'text',
          text: 'ARCHIVE READY. OPENING 2024 MISSION...'
        })

        appendEntry({
          id: `divider-${Date.now()}`,
          kind: 'hr',
        })

        await sleep(260)
        router.push('/map')

        appendOptionsEntry()
        setShowPrompt(true)
      } else if (trimmed) {
        setShowPrompt(false)
        appendEntry({
          id: `unknown-${Date.now()}`,
          kind: 'text',
          text: `UNKNOWN COMMAND: ${trimmed}`,
        })

        appendOptionsEntry()
        setShowPrompt(true)
      }

      setUserInput('')
      setIsProcessing(false)
    },
    [appendEntry, appendOptionsEntry, isProcessing, router, showPrompt, sleep, updateEntry],
  )

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPrompt) return

      if (e.key === 'Enter') {
        handleCommand(userInput)
      } else if (e.key === 'Backspace') {
        setUserInput(prev => prev.slice(0, -1))
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
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

      {/* Main content */}
      <div
        ref={containerRef}
        className="relative z-0 w-full h-full overflow-auto p-4 sm:p-8 font-mono pb-16"
        style={{
          textShadow: '0 0 5px rgba(51, 255, 51, 0.8), 0 0 10px rgba(51, 255, 51, 0.5), 0 0 20px rgba(51, 255, 51, 0.3)',
        }}
      >
        {/* Terminal stream */}
        <div className="text-[#33ff33] text-sm sm:text-base leading-relaxed">
          {entries.map(entry => {
            if (entry.kind === 'hr') {
              return (
                <div key={entry.id} className="min-h-[1.5em] w-full">
                  <hr className="border-0 border-t border-[#33ff33] opacity-70 w-full" />
                </div>
              )
            }

            if (entry.kind === 'options') {
              const isActiveOptions = entry.id === activeOptionsId
              return (
                <div key={entry.id} className="text-[#33ff33] text-sm sm:text-base leading-relaxed mt-2 animate-fadeIn">
                  <div>Click, tap or enter command to continue:</div>
                  <div className="mt-3 overflow-x-auto">
                    <div className="inline-flex gap-3 whitespace-nowrap pr-4">
                      {COMMAND_OPTIONS.map((option, index) => (
                        <div
                          key={`${entry.id}-${option.key}`}
                          className="min-h-[1.5em]"
                          style={{ animationDelay: `${index * 0.2}s` }}
                        >
                          <button
                            type="button"
                            onClick={() => option.href !== '#' && handleCommand(option.key)}
                            className={`inline-flex items-center px-3 py-2 tracking-[0.15em] uppercase transition-colors duration-150 bg-black text-[#33ff33] shadow-[0_0_12px_rgba(51,255,51,0.25)] ${
                              option.href === '#'
                                ? 'border border-dashed border-[#33ff33]/50 opacity-50 cursor-not-allowed hover:bg-black hover:text-[#33ff33]'
                                : 'border border-[#33ff33] hover:bg-[#33ff33] hover:text-black'
                            }`}
                            disabled={isProcessing || option.href === '#' || !isActiveOptions}
                          >
                            <span className="font-bold underline">{option.key}</span>
                            <span className="ml-1 font-semibold">▓</span>
                            <span className="ml-3 leading-none">{option.label}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }

            if (entry.kind === 'ascii') {
              return (
                <pre
                  key={entry.id}
                  className="text-[#33ff33] text-[6px] sm:text-[8px] md:text-[10px] leading-none mt-4 mb-4 animate-fadeIn whitespace-pre overflow-x-auto"
                  style={{
                    textShadow: '0 0 10px rgba(51, 255, 51, 0.9), 0 0 20px rgba(51, 255, 51, 0.6), 0 0 40px rgba(51, 255, 51, 0.4)',
                  }}
                >
                  {entry.text ?? ASCII_TITLE}
                </pre>
              )
            }

            return (
              <div key={entry.id} className="min-h-[1.5em]">
                {entry.text}
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
