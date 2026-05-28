import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API kulcs hiányzik' }, { status: 500 })

    const { systemPrompt, messages, maxTokens = 512 } = await req.json()

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    })

    const text = response.content.find(b => b.type === 'text')
    return NextResponse.json({ content: text?.type === 'text' ? text.text : '—' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Multi-chat hiba:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
