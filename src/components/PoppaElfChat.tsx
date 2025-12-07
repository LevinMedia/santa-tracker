'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface PoppaElfChatProps {
  isOpen: boolean
  onClose: () => void
}

// Dummy initial messages
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'dummy-1',
    role: 'user',
    content: 'When was Santa in New York?',
    timestamp: new Date(Date.now() - 60000)
  },
  {
    id: 'dummy-2',
    role: 'assistant',
    content: 'Ho ho ho! Santa visited **New York** on December 24th, 2024 at approximately **11:23 PM EST**.\n\nHe made stops at:\n- Times Square\n- Central Park\n- Brooklyn Bridge\n\n*That was quite a busy night in the Big Apple!*',
    timestamp: new Date(Date.now() - 50000)
  },
  {
    id: 'dummy-3',
    role: 'user',
    content: 'How many stops did he make total?',
    timestamp: new Date(Date.now() - 40000)
  },
  {
    id: 'dummy-4',
    role: 'assistant',
    content: 'Santa made a grand total of **48,588 stops** during his 2024 journey around the world!\n\nThat\'s quite impressive, even for the jolliest man in the world. Here are some fun facts:\n\n1. **Fastest speed**: Reached over 1,200 mph during some long-distance hops\n2. **Most stops in one country**: United States with thousands of cities\n3. **Longest single leg**: Crossed the Pacific Ocean in record time\n\n*The magic of Christmas makes all things possible!*',
    timestamp: new Date(Date.now() - 30000)
  }
]

export default function PoppaElfChat({ isOpen, onClose }: PoppaElfChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Load messages from sessionStorage when chat opens, or use initial dummy messages
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && !hasInitialized) {
      const savedMessages = sessionStorage.getItem('poppa-elf-messages')
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages)
          if (parsed.length > 0) {
            // Check if these are the initial dummy messages (by checking for dummy IDs)
            const hasDummyMessages = parsed.some((msg: any) => msg.id?.startsWith('dummy-'))
            if (hasDummyMessages) {
              setMessages(parsed.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              })))
              setHasInitialized(true)
              return
            }
            // User has added their own messages, use those
            setMessages(parsed.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })))
            setHasInitialized(true)
            return
          }
        } catch (e) {
          // Invalid data, fall through to use initial messages
        }
      }
      // No saved messages or empty, use initial dummy messages
      setMessages(INITIAL_MESSAGES)
      setHasInitialized(true)
    } else if (!isOpen) {
      // Reset initialization when closed
      setHasInitialized(false)
    }
  }, [isOpen, hasInitialized])

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0 && hasInitialized) {
      const messagesWithTimestamps = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      }))
      sessionStorage.setItem('poppa-elf-messages', JSON.stringify(messagesWithTimestamps))
    }
  }, [messages, hasInitialized])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Prepare messages for API (convert to format expected by API)
      const apiMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch('/api/poppa-elf/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response from Poppa Elf')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Ho ho ho! I apologize, but I encountered an error. Please try again!',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/80 z-[1001] md:bg-black/60"
        onClick={onClose}
      />

      {/* Chat drawer */}
      <div
        className={`
          fixed z-[1002] font-mono
          left-0 right-0 top-0 bottom-0 h-screen md:h-full
          md:left-auto md:right-0 md:top-0 md:w-96
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col bg-black border border-[#33ff33]/60 md:border-r-0 md:border-t-0 md:border-b-0 md:border-l-2">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#33ff33]/10 border-b border-[#33ff33]/40">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#33ff33]/40 border border-[#33ff33]/60" />
              </div>
              <span className="text-[#33ff33] text-xs uppercase tracking-wider">
                ASK POPPA ELF
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 bg-[#33ff33] text-black border border-[#33ff33] hover:bg-black hover:text-[#33ff33] transition-colors text-xs px-2 py-1 cursor-pointer"
            >
              CLOSE
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {messages.length === 0 && (
              <div className="text-center text-[#66ff66]/60 text-sm mt-8">
                <p className="mb-2">Ho ho ho! I'm Poppa Elf, the oldest and wisest elf at the North Pole.</p>
                <p>Ask me anything about Santa's 2024 flight!</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${
                  message.role === 'user'
                    ? 'bg-[#33ff33] text-black self-end'
                    : 'text-[#66ff66] self-start'
                } p-3 rounded border border-[#33ff33]/30 max-w-[80%]`}
              >
                {message.role === 'assistant' && (
                  <div className="text-xs mb-1 opacity-70">
                    Poppa Elf
                  </div>
                )}
                {message.role === 'assistant' ? (
                  <div className="text-sm prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-[#66ff66]">{children}</strong>,
                        em: ({ children }) => <em className="italic text-[#66ff66]/90">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                        code: ({ children }) => <code className="bg-black/30 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-[#66ff66]/50 pl-2 italic">{children}</blockquote>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="text-[#66ff66] p-3 self-start max-w-[80%]">
                <div className="text-xs mb-1 opacity-70">Poppa Elf</div>
                <div className="text-sm">Thinking...</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 p-3 border-t border-[#33ff33]/30">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Poppa Elf..."
                className="flex-1 bg-black border border-[#33ff33]/50 text-[#33ff33] text-sm px-3 py-2 focus:outline-none focus:border-[#33ff33]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-[#33ff33] text-black border border-[#33ff33] hover:bg-black hover:text-[#33ff33] transition-colors text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                SEND
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

