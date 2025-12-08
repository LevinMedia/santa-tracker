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

export default function PoppaElfChat({ isOpen, onClose }: PoppaElfChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [introStep, setIntroStep] = useState<'connecting' | 'entered' | 'greeting' | 'complete'>('connecting')
  const [greetingMessage, setGreetingMessage] = useState('')
  const [connectingDots, setConnectingDots] = useState('')

  // Load messages from sessionStorage when chat opens, or start intro sequence
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && !hasInitialized) {
      const savedMessages = sessionStorage.getItem('poppa-elf-messages')
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages)
          if (parsed.length > 0) {
            // User has saved messages, use those
            setMessages(parsed.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })))
            setHasInitialized(true)
            return
          }
        } catch (e) {
          // Invalid data, fall through to start intro
        }
      }
      // No saved messages - start intro sequence
      setShowIntro(true)
      setIntroStep('connecting')
    } else if (!isOpen) {
      // Reset initialization when closed
      setHasInitialized(false)
      setShowIntro(false)
      setIntroStep('connecting')
      setGreetingMessage('')
    }
  }, [isOpen, hasInitialized])

  // Handle intro sequence
  useEffect(() => {
    if (!showIntro || !isOpen) return

    const runIntroSequence = async () => {
      // Step 1: "Establishing connection with north pole..." (1.5 seconds)
      setIntroStep('connecting')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Add connection message to chat
      const connectionMsg: Message = {
        id: `connection-${Date.now()}`,
        role: 'assistant',
        content: 'Establishing connection with north pole...',
        timestamp: new Date()
      }
      setMessages([connectionMsg])

      // Step 2: "Poppa Elf has entered the chat" (0.5 seconds)
      setIntroStep('entered')
      await new Promise(resolve => setTimeout(resolve, 500))

      // Add entered message to chat
      const enteredMsg: Message = {
        id: `entered-${Date.now()}`,
        role: 'assistant',
        content: 'Poppa Elf has entered the chat',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, enteredMsg])

      // Step 3: Get and stream greeting from Poppa Elf (start immediately)
      setIntroStep('greeting')
      
      // Create greeting message placeholder
      const greetingMsgId = `greeting-${Date.now()}`
      const greetingMsg: Message = {
        id: greetingMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, greetingMsg])
      
      let finalGreetingContent = ''
      
      try {
        const response = await fetch('/api/poppa-elf/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages: [{ 
              role: 'user', 
              content: 'Hello! Please introduce yourself with a warm, friendly greeting.' 
            }] 
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error(`Failed to get greeting: ${response.status} ${response.statusText}`, errorText)
          throw new Error(`Failed to get greeting: ${response.status} ${response.statusText}`)
        }

        // Stream the greeting and update the message in real-time
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            if (value) {
              const chunk = decoder.decode(value, { stream: true })
              accumulatedContent += chunk
              setGreetingMessage(accumulatedContent)
              
              // Update the greeting message in the messages array as it streams
              setMessages(prev => prev.map(msg => 
                msg.id === greetingMsgId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              ))
            }
          }
          reader.releaseLock()
        }
        
        finalGreetingContent = accumulatedContent || 'Well hello there! I\'m Poppa Elf, the oldest and wisest elf at the North Pole. How can I help you today?'
      } catch (error) {
        // Log error but don't show it to the user - use fallback greeting instead
        console.error('Error getting greeting:', error)
        finalGreetingContent = 'Well hello there! I\'m Poppa Elf, the oldest and wisest elf at the North Pole. How can I help you today?'
        setGreetingMessage(finalGreetingContent)
        
        // Update message with error fallback
        setMessages(prev => prev.map(msg => 
          msg.id === greetingMsgId
            ? { ...msg, content: finalGreetingContent }
            : msg
        ))
      }

      // Step 4: Complete intro
      setIntroStep('complete')
      setShowIntro(false)
      setHasInitialized(true)
      // Focus input after intro completes
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    runIntroSequence()
  }, [showIntro, isOpen])

  // Animate connecting dots
  useEffect(() => {
    if (introStep !== 'connecting') {
      setConnectingDots('')
      return
    }

    const dots = ['.', '..', '...']
    let currentIndex = 0

    const interval = setInterval(() => {
      setConnectingDots(dots[currentIndex])
      currentIndex = (currentIndex + 1) % dots.length
    }, 500)

    return () => clearInterval(interval)
  }, [introStep])

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

  const clearChatHistory = () => {
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('poppa-elf-messages')
    }
    // Reset to empty and start intro sequence
    setMessages([])
    setHasInitialized(false)
    setShowIntro(true)
    setIntroStep('connecting')
    setGreetingMessage('')
  }

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

    // Create a placeholder message for streaming
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      // Prepare messages for API (convert to format expected by API)
      // Limit to last 4 messages (2 exchanges) to avoid token limit issues
      // The backend will further limit if needed
      const recentMessages = [...messages, userMessage].slice(-4)
      const apiMessages = recentMessages.map(msg => ({
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
        const errorText = await response.text().catch(() => 'Unknown error')
        let errorMessage = 'Failed to get response from Poppa Elf'
        
        if (response.status === 429) {
          errorMessage = 'The request is too large. Please try a shorter message or wait a moment.'
        } else if (response.status === 500) {
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.message?.includes('rate_limit') || errorData.message?.includes('too large')) {
              errorMessage = 'The request is too large. Please try a shorter message or wait a moment.'
            } else if (errorData.message) {
              errorMessage = `Error: ${errorData.message}`
            }
          } catch {
            // If parsing fails, use default message
          }
        }
        
        throw new Error(errorMessage)
      }

      // Handle streaming response
      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let hasStartedStreaming = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            accumulatedContent += chunk

            // Clear loading state when first chunk arrives
            if (!hasStartedStreaming && accumulatedContent.trim().length > 0) {
              setIsLoading(false)
              hasStartedStreaming = true
            }

            // Update the message with accumulated content
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ))
          }
        }
      } finally {
        // Ensure loading is cleared
        setIsLoading(false)
        reader.releaseLock()
        // Refocus input after response completes
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again!'
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: `Oh my snowflakes! I apologize, but ${errorMessage}` }
          : msg
      ))
      setIsLoading(false)
      // Refocus input on error
      setTimeout(() => inputRef.current?.focus(), 100)
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
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
        .pulse-roll-text {
          background: linear-gradient(to right, #33ff33 0%, #66ff66 50%, #33ff33 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>
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
            <div className="flex items-center gap-2">
              <button
                onClick={clearChatHistory}
                className="flex items-center gap-1.5 bg-black text-[#33ff33] border border-[#33ff33] hover:bg-[#33ff33] hover:text-black transition-colors text-xs px-2 py-1 cursor-pointer"
              >
                CLEAR
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 bg-[#33ff33] text-black border border-[#33ff33] hover:bg-black hover:text-[#33ff33] transition-colors text-xs px-2 py-1 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {/* Intro sequence - only show connecting animation while connecting */}
            {showIntro && introStep === 'connecting' && (
              <div className="py-1 self-start">
                <div className="pulse-roll-text whitespace-nowrap" style={{ fontSize: '12px' }}>
                  Establishing connection with north pole{connectingDots}
                </div>
              </div>
            )}
            
            {!showIntro && messages.length === 0 && (
              <div className="text-center text-[#66ff66]/60 text-sm mt-8">
                <p className="mb-2">Well hello there! I'm Poppa Elf, the oldest and wisest elf at the North Pole.</p>
                <p>Ask me anything about Santa's 2024 flight!</p>
              </div>
            )}
            
            {messages.map((message) => (
              (message.role === 'assistant' && !message.content.trim() ? null : (
              <div
                key={message.id}
                className={`${
                  message.role === 'user'
                    ? 'bg-[#33ff33] text-black self-end'
                    : message.id?.startsWith('connection-') || message.id?.startsWith('entered-')
                    ? 'text-[#66ff66] self-start py-0.5'
                    : 'text-[#66ff66] self-start'
                } ${message.id?.startsWith('connection-') || message.id?.startsWith('entered-') ? '' : 'p-3 rounded border border-[#33ff33]/30'} ${message.id?.startsWith('connection-') || message.id?.startsWith('entered-') ? '' : 'max-w-[80%]'} ${message.id?.startsWith('connection-') ? 'mb-2' : ''}`}
              >
                {message.role === 'assistant' && message.content.trim().length > 0 && !message.id?.startsWith('connection-') && !message.id?.startsWith('entered-') && (
                  <div className="text-xs mb-1 opacity-70">
                    Poppa Elf
                  </div>
                )}
                {message.role === 'assistant' ? (
                  message.id?.startsWith('connection-') || message.id?.startsWith('entered-') ? (
                    <div className="pulse-roll-text whitespace-nowrap" style={{ fontSize: '12px' }}>
                      {message.content}
                    </div>
                  ) : (
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
                  )
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
              ))
            ))}

            {isLoading && (
              <div className="p-3 self-start">
                <div className="pulse-roll-text whitespace-nowrap" style={{ fontSize: '12px' }}>
                  Sending your message to the north pole...
                </div>
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
                disabled={isLoading || showIntro}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || showIntro}
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

