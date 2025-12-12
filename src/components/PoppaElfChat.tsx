'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { PhoneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid'

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
  const [isSpeechMode, setIsSpeechMode] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showModeSelection, setShowModeSelection] = useState(false)
  const [hasChosenMode, setHasChosenMode] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [introStep, setIntroStep] = useState<'connecting' | 'entered' | 'greeting' | 'complete'>('connecting')
  const [greetingMessage, setGreetingMessage] = useState('')
  const [hasPlayedGreetingSpeech, setHasPlayedGreetingSpeech] = useState(false)
  const [connectingDots, setConnectingDots] = useState('')
  const [speechPreview, setSpeechPreview] = useState<{ content: string; status: 'visible' | 'fading' } | null>(null)
  const speechPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevIsSpeakingRef = useRef(false)
  const [firstAssistantReceived, setFirstAssistantReceived] = useState(false)
  const [isSpeechPreparing, setIsSpeechPreparing] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load messages from sessionStorage when chat opens, or start intro sequence
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && !hasInitialized) {
      const savedMessages = sessionStorage.getItem('poppa-elf-messages')
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages) as Array<{
            id: string
            role: 'user' | 'assistant'
            content: string
            timestamp: string
          }>
          if (Array.isArray(parsed) && parsed.length > 0) {
            // User has saved messages, use those
            setMessages(parsed.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })))
            const hasAssistant = parsed.some(msg => msg.role === 'assistant' && msg.content?.trim())
            setFirstAssistantReceived(hasAssistant)
            setHasInitialized(true)
            setHasChosenMode(true)
            setShowModeSelection(false)
            setHasPlayedGreetingSpeech(false)
            return
          }
        } catch {
          // Invalid data, fall through to start intro
        }
      }
      // No saved messages - wait for user to pick how to talk
      setShowModeSelection(true)
      setShowIntro(false)
      setIntroStep('connecting')
      setHasChosenMode(false)
    } else if (!isOpen) {
      // Reset initialization when closed
      setHasInitialized(false)
      setShowIntro(false)
      setIntroStep('connecting')
      setGreetingMessage('')
      setShowModeSelection(false)
      setHasChosenMode(false)
      setIsSpeechMode(false)
      setHasPlayedGreetingSpeech(false)
      setFirstAssistantReceived(false)
      setIsSpeechPreparing(false)
    }
  }, [isOpen, hasInitialized])

  // Handle intro sequence
  useEffect(() => {
    if (!showIntro || !isOpen || !hasChosenMode) return

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
      setGreetingMessage(finalGreetingContent)
      if (finalGreetingContent.trim()) {
        setFirstAssistantReceived(true)
      }
      // Focus input after intro completes
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    runIntroSequence()
  }, [showIntro, isOpen, hasChosenMode])

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

  const handleModeSelection = (mode: 'speech' | 'chat') => {
    const wantsSpeech = mode === 'speech'
    setIsSpeechMode(wantsSpeech)
    setShowModeSelection(false)
    setHasChosenMode(true)
    setHasPlayedGreetingSpeech(mode !== 'speech')
    setShowIntro(true)
    setIntroStep('connecting')
    setGreetingMessage('')
  }

  const clearChatHistory = () => {
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('poppa-elf-messages')
    }
    // Reset to empty and start intro sequence
    setMessages([])
    setHasInitialized(false)
    setShowIntro(false)
    setIntroStep('connecting')
    setGreetingMessage('')
    setShowModeSelection(true)
    setHasChosenMode(false)
    setIsSpeechMode(false)
    setHasPlayedGreetingSpeech(false)
    setFirstAssistantReceived(false)
    setIsSpeechPreparing(false)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
      setIsSpeaking(false)
    }
  }

  const playSpeech = async (text: string) => {
    if (!text.trim()) return
    try {
      setIsSpeechPreparing(true)
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
        currentAudioRef.current = null
      }
      const response = await fetch('/api/poppa-elf/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error('Unable to start Poppa Elf speech')
      }

      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudioRef.current = audio

      audio.onplay = () => {
        setIsSpeechPreparing(false)
        setIsSpeaking(true)
      }
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
        }
        setIsSpeaking(false)
        setIsSpeechPreparing(false)
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
        }
        setIsSpeaking(false)
        setIsSpeechPreparing(false)
      }

      await audio.play()
    } catch (error) {
      console.error('Error playing Poppa Elf speech:', error)
      setIsSpeaking(false)
      setIsSpeechPreparing(false)
    }
  }

  // Auto-play the greeting when speech mode was chosen for a fresh chat
  useEffect(() => {
    if (!isSpeechMode || hasPlayedGreetingSpeech || introStep !== 'complete') return
    if (!greetingMessage.trim()) return

    const speakGreeting = async () => {
      await playSpeech(greetingMessage.trim())
      setHasPlayedGreetingSpeech(true)
    }

    speakGreeting()
  }, [isSpeechMode, hasPlayedGreetingSpeech, introStep, greetingMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // If we're in speech mode and Poppa Elf is talking/preparing, interrupt current audio
    if (isSpeechMode && (isSpeaking || isSpeechPreparing) && currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
      setIsSpeaking(false)
      setIsSpeechPreparing(false)
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    if (isSpeechMode) {
      if (speechPreviewTimeoutRef.current) {
        clearTimeout(speechPreviewTimeoutRef.current)
      }
      setSpeechPreview({ content: userMessage.content, status: 'visible' })
    }

    // Create a placeholder message for streaming
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])

    let finalAssistantContent = ''

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

      // Handle streaming response for both chat and speech modes
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

            const trimmed = accumulatedContent.trim()

            // Clear loading state when first chunk arrives
            if (!hasStartedStreaming && trimmed.length > 0) {
              setIsLoading(false)
              hasStartedStreaming = true
            }

            // Update the message with accumulated content
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ))

            // Mark first assistant receipt as soon as we have content
            if (!firstAssistantReceived && trimmed.length > 0) {
              setFirstAssistantReceived(true)
            }
          }
        }
      } finally {
        finalAssistantContent = accumulatedContent
        // Ensure loading is cleared
        setIsLoading(false)
        if (!firstAssistantReceived && finalAssistantContent.trim()) {
          setFirstAssistantReceived(true)
        }
        reader.releaseLock()

        // If in speech mode, play the full response once streaming is done to avoid split audio
        if (isSpeechMode && finalAssistantContent.trim()) {
          playSpeech(finalAssistantContent.trim())
        }

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
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current
      container.scrollTo({
        top: container.scrollHeight,
        behavior: messages.length > 1 ? 'smooth' : 'auto'
      })
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Clear any pending preview timeout on unmount or mode change
  useEffect(() => {
    return () => {
      if (speechPreviewTimeoutRef.current) {
        clearTimeout(speechPreviewTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSpeechMode) {
      setSpeechPreview(null)
      if (speechPreviewTimeoutRef.current) {
        clearTimeout(speechPreviewTimeoutRef.current)
      }
    }
  }, [isSpeechMode])

  useEffect(() => {
    if (!isSpeechMode) {
      prevIsSpeakingRef.current = isSpeaking
      return
    }

    const wasSpeaking = prevIsSpeakingRef.current
    if (wasSpeaking && !isSpeaking && speechPreview) {
      setSpeechPreview(prev => (prev ? { ...prev, status: 'fading' } : prev))
      if (speechPreviewTimeoutRef.current) {
        clearTimeout(speechPreviewTimeoutRef.current)
      }
      speechPreviewTimeoutRef.current = setTimeout(() => setSpeechPreview(null), 800)
    }
    prevIsSpeakingRef.current = isSpeaking
  }, [isSpeaking, isSpeechMode, speechPreview])

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
        @keyframes speech-pulse {
          0% { transform: scale(1); }
          100% { transform: scale(0.94); }
        }
        .speech-pulse {
          animation: speech-pulse 0.9s ease-in-out infinite alternate;
        }
        @keyframes subtle-pulse {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .subtle-pulse {
          animation: subtle-pulse 1.5s ease-in-out infinite;
        }
        @keyframes ring-tilt {
          0% { transform: rotate(0deg); }
          6% { transform: rotate(-10deg); }
          12% { transform: rotate(10deg); }
          18% { transform: rotate(-8deg); }
          24% { transform: rotate(8deg); }
          30% { transform: rotate(-5deg); }
          36% { transform: rotate(5deg); }
          42% { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        .ring-tilt {
          animation: ring-tilt 1.8s ease-in-out infinite;
          transform-origin: center center;
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
          left-0 right-0 top-0 bottom-0 h-[100dvh] max-h-[100dvh]
          md:h-full md:max-h-full md:left-auto md:right-0 md:top-0 md:w-96
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
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto min-h-0 p-4 pb-6 md:pb-4 scrollbar-thin"
          >
            {isSpeechMode ? (
              <div className="flex flex-col items-center justify-center text-center text-[#66ff66] min-h-full gap-4">
                <img
                  src="/ChatGPT%20Image%20Dec%2010,%202025,%2007_29_20%20AM.png"
                  alt="Poppa Elf"
                  className={`w-40 h-40 object-contain transition-transform duration-500 ease-in-out ${isSpeaking ? 'speech-pulse' : ''}`}
                />
                <div className="max-w-md text-sm text-[#66ff66]/80 text-center">
                  We're still working the kinks out of communication with the north pole, for now, send poppa elf a message, and he'll reply on the call!
                </div>
                <button
                  onClick={() => setIsSpeechMode(false)}
                  className="text-xs px-3 py-1.5 border border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33]/10 transition-colors cursor-pointer"
                >
                  Switch to chat
                </button>
                {speechPreview && (
                  <div
                    className={`bg-[#33ff33] text-black self-stretch w-full p-3 rounded border border-[#33ff33]/30 transition-opacity duration-500 ${
                      speechPreview.status === 'fading' ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <div className="text-xs mb-1 opacity-70">You</div>
                    <div className="text-sm whitespace-pre-wrap">{speechPreview.content}</div>
                  </div>
                )}
                {isSpeechMode && (
                  <div className="text-xs uppercase tracking-wide text-[#33ff33] subtle-pulse">
                    {isSpeaking
                      ? 'Poppa Elf is talking...'
                      : isSpeechPreparing
                      ? 'Receiving satellite downlink...'
                      : isLoading
                      ? 'Sending your message to the north pole...'
                      : firstAssistantReceived
                      ? ''
                      : 'CONNECTING TO THE NORTH POLE...'}
                  </div>
                )}
              </div>
            ) : showModeSelection ? (
              <div className="flex flex-col items-center justify-center text-center text-[#66ff66] gap-3 min-h-full">
                <div className="text-[11px] uppercase tracking-wide text-[#66ff66]/80">
                  Incoming call from:
                </div>
                <img
                  src="/ChatGPT%20Image%20Dec%2010,%202025,%2007_29_20%20AM.png"
                  alt="Poppa Elf"
                  className="w-40 h-40 object-cover ring-tilt"
                />
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => handleModeSelection('speech')}
                    className="flex items-center justify-center gap-2 w-full bg-[#33ff33] text-black border border-[#33ff33] hover:bg-[#66ff66] transition-colors px-4 py-3 cursor-pointer"
                  >
                    <PhoneIcon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Accept call</span>
                  </button>
                  <button
                    onClick={() => handleModeSelection('chat')}
                    className="flex items-center justify-center gap-2 w-full border border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33]/10 transition-colors px-4 py-3 cursor-pointer"
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Chat with Poppa Elf</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {/* Intro sequence - only show connecting animation while connecting */}
                {showIntro && introStep === 'connecting' && (
                  <div className="py-1 self-start">
                    <div className="pulse-roll-text whitespace-nowrap" style={{ fontSize: '12px' }}>
                      Establishing connection with north pole{connectingDots}
                    </div>
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
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 p-3 border-t border-[#33ff33]/30 sticky bottom-0 left-0 right-0 bg-black">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Poppa Elf..."
                className="flex-1 bg-black border border-[#33ff33]/50 text-[#33ff33] text-base px-3 py-2 focus:outline-none focus:border-[#33ff33]"
                disabled={isLoading || showIntro || showModeSelection}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || showIntro || showModeSelection}
                className="bg-[#33ff33] text-black border border-[#33ff33] hover:bg-black hover:text-[#33ff33] transition-colors text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                SEND
              </button>
              <button
                type="button"
                onClick={() => setIsSpeechMode(prev => !prev)}
                disabled={showModeSelection}
                aria-label="Toggle phone call mode"
                className={`border text-xs px-3 py-2 cursor-pointer transition-colors flex items-center justify-center ${
                  isSpeechMode
                    ? 'bg-[#33ff33] text-black border-[#33ff33]'
                    : 'bg-black text-[#33ff33] border-[#33ff33] hover:bg-[#33ff33] hover:text-black'
                } ${showModeSelection ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <PhoneIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

