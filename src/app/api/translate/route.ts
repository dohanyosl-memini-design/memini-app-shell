import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const { text, targetLang } = await request.json()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const langName = targetLang === 'DE' ? 'German' : targetLang ?? 'German'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a professional translator specializing in B2B business communication.
Translate the given Hungarian text to ${langName}.
Be precise, professional, and maintain the tone and formatting of the original.
Preserve any template variables like {cegnev}, {kapcsolattarto_neve}, etc. as-is.
Return only the translated text, nothing else.`,
    messages: [{ role: 'user', content: text }],
  })

  const translatedBlock = response.content.find(b => b.type === 'text')
  const translated = translatedBlock?.type === 'text' ? translatedBlock.text : ''

  return NextResponse.json({ translated })
}
