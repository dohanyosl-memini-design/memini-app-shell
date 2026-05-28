import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, messages, maxTokens = 512, provider = 'anthropic', model } = await req.json()

    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY nincs beállítva' }, { status: 500 })

      const client = new OpenAI({ apiKey })
      const response = await client.chat.completions.create({
        model: model || 'gpt-4o',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      })
      return NextResponse.json({ content: response.choices[0].message.content || '—' })
    }

    // Anthropic (default)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY nincs beállítva' }, { status: 500 })

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: model || 'claude-sonnet-4-6',
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
