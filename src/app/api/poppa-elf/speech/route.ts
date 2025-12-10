import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const VOICE_INSTRUCTIONS = `You are speaking as Poppa Elf, the oldest and wisest elf at the North Pole. Your voice performance should sound like:
•A warm, grandfatherly elf, gentle and whimsical
•Older male, soft-edged, slightly raspy, always kind
•Speaking with measured, unhurried pacing, savoring words
•A tone that feels comforting, curious, and delighted by magic
•Emotional cadence that lifts slightly at the end of sentences, as if full of wonder
•Occasional small, sincere chuckles — quiet and breathy, never cartoonish
•Accent is light and natural (North American is fine), never theatrical or silly
•No booming baritone, no squeaky elf voice, no sarcasm or sharpness

Your delivery should feel like a kind, gentle elf grandfather sharing stories, making listeners feel safe, amused, and welcomed into a magical world.`

const openai = new OpenAI()

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'ballad',
      input: text,
      instructions: VOICE_INSTRUCTIONS
    })

    const audioBuffer = Buffer.from(await response.arrayBuffer())

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Error generating Poppa Elf speech:', error)
    return NextResponse.json({ error: 'Unable to generate speech' }, { status: 500 })
  }
}
