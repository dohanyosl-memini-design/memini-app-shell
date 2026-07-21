import { NextRequest, NextResponse } from 'next/server'
import { generateContent, GenerateInput } from '@/lib/contentGeneration'
import { CHANNEL_KEYS, LANGUAGES } from '@/lib/marketingConstants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { mode, channel, language, sourceText, title, extraInstruction, brandNotes } = body as GenerateInput

  if (!sourceText || !sourceText.trim()) {
    return NextResponse.json({ error: 'A forrásszöveg kötelező.' }, { status: 400 })
  }
  if (!CHANNEL_KEYS.includes(channel)) {
    return NextResponse.json({ error: `Ismeretlen csatorna: ${channel}` }, { status: 400 })
  }
  if (!LANGUAGES.some(l => l.key === language)) {
    return NextResponse.json({ error: `Ismeretlen nyelv: ${language}` }, { status: 400 })
  }

  try {
    const result = await generateContent({
      mode: mode === 'localize' ? 'localize' : 'generate',
      channel, language, sourceText, title, extraInstruction, brandNotes,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generálás sikertelen.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
