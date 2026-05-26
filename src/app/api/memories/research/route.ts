import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { companyId } = await request.json()
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

  const sources: string[] = []

  // Fetch website
  if (company.website) {
    try {
      const res = await fetch(company.website, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRM-Bot/1.0)' },
      })
      if (res.ok) {
        const html = await res.text()
        // Strip HTML tags and get plain text
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000)
        sources.push(`=== Website (${company.website}) ===\n${text}`)
      }
    } catch {
      // Ignore fetch errors
    }
  }

  // Brave Search
  const braveKey = process.env.BRAVE_SEARCH_API_KEY
  if (braveKey) {
    try {
      const q = encodeURIComponent(`${company.name} ${company.city ?? ''}`.trim())
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=5`, {
        headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json() as { web?: { results?: { title: string; description: string; url: string }[] } }
        const results = data.web?.results ?? []
        const text = results
          .map(r => `- ${r.title}: ${r.description} (${r.url})`)
          .join('\n')
        if (text) sources.push(`=== Brave Search eredmények ===\n${text}`)
      }
    } catch {
      // Ignore
    }
  }

  if (sources.length === 0) {
    return NextResponse.json({ summary: 'Nem sikerült adatot gyűjteni – nincs elérhető weboldal és keresési eredmény.' })
  }

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Te egy CRM asszisztens vagy. A feladatod: egy cégről összegyűjtött webes adatok alapján rövid, tényszerű összefoglalót írni.
FONTOS: Csak azt írd le, ami az adatokban ténylegesen szerepel. Ne találj ki semmit. Ne hallucinálj.
Az összefoglaló legyen rövid (max 300 szó), lényegre törő, magyar nyelven.
Tartalmazza: mivel foglalkozik a cég, mik a fő termékek/szolgáltatások, érdekességek, releváns infók.`,
    messages: [
      {
        role: 'user',
        content: `Cég neve: ${company.name}\nVáros: ${company.city ?? 'ismeretlen'}\n\nGyűjtött adatok:\n\n${sources.join('\n\n')}`,
      },
    ],
  })

  const summaryText = response.content.find(b => b.type === 'text')
  const summary = summaryText?.type === 'text' ? summaryText.text : 'Nem sikerült összefoglalót készíteni.'

  // Find the "web" system memory type
  const webType = await prisma.memoryEntryType.findFirst({ where: { label: 'Webes forrás' } })

  if (webType) {
    await prisma.memoryEntry.create({
      data: {
        companyId,
        typeId: webType.id,
        content: summary,
        source: 'web',
        date: new Date(),
      },
    })
  }

  return NextResponse.json({ summary, saved: !!webType })
}
