import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const monthStr = monthAgo.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const [monthInvoices, allCompanies, wonDeals, topProducts] = await Promise.all([
    prisma.invoice.findMany({
      where: { date: { gte: monthAgo, lte: monthEnd } },
      include: { company: { select: { name: true } } },
    }),
    prisma.company.findMany({
      include: {
        invoices: {
          where: { date: { gte: monthAgo, lte: monthEnd } },
          select: { total: true, status: true },
        },
        _count: { select: { orders: true } },
      },
    }),
    prisma.deal.findMany({
      where: { stage: 'won', updatedAt: { gte: monthAgo } },
      include: { company: { select: { name: true } } },
    }),
    prisma.product.findMany({
      orderBy: { stock: 'asc' },
      take: 10,
    }),
  ])

  const totalRevenue = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const openRevenue = monthInvoices.filter(i => ['open', 'sent'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const topPartners = allCompanies
    .map(c => ({ name: c.name, revenue: c.invoices.reduce((s, i) => s + i.total, 0) }))
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const lowStock = topProducts.filter(p => p.stock !== null && p.stock < 10)

  const dataContext = `
Hónap: ${monthStr}

HAVI BEVÉTEL:
- Befolyt: ${totalRevenue.toFixed(2)} €
- Nyitott/várható: ${openRevenue.toFixed(2)} €
- Számlák száma: ${monthInvoices.length} db

TOP PARTNEREK (havi bevétel alapján):
${topPartners.map((p, i) => `${i + 1}. ${p.name}: ${p.revenue.toFixed(2)} €`).join('\n') || 'Nincs adat'}

MEGNYERT DEALEK: ${wonDeals.length} db
${wonDeals.map(d => `- ${d.company?.name || ''} | értéke: ${d.value ? d.value.toFixed(2) + ' €' : 'ismeretlen'}`).join('\n') || 'Nincs'}

ALACSONY KÉSZLET (10 db alatt):
${lowStock.map(p => `- ${p.name} (${p.sku}): ${p.stock} db`).join('\n') || 'Nincs kritikus készlethiány'}
`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Te Arthur vagy, a Memini Design AI asszisztense. A Memini Design helyspecifikus souvenir hűtőmágneseket értékesít B2B partnereknek (kastélyok, múzeumok, templomok) Ulm központtal.

Az alábbi adatok alapján készítsd el a havi jelentést MAGYARUL:

${dataContext}

A jelentés tartalmazzon:
1. **Havi összefoglaló** — mi történt, hogyan alakult a bevétel
2. **Top partnerek értékelése** — kik teljesítettek jól, ki szorul több figyelemre
3. **Következő hónap prioritásai** — konkrét célok és teendők
4. **Stratégiai javaslat** — 1-2 konkrét javaslat a növekedéshez a Memini Design logikája alapján (B2B fókusz, hűtőmágnes, nagy potenciálú partnerek)
5. **Figyelmeztetések** — alacsony készlet, lemaradó partnerek, elmaradt follow-upok

Légy konkrét és üzletileg gondolkozz. Kerüld az üres frázisokat.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  await prisma.arthurReport.create({
    data: {
      type: 'monthly',
      title: `Havi jelentés – ${monthStr}`,
      summary: text,
      drafts: [],
    },
  })

  return NextResponse.json({ ok: true, message: 'Havi jelentés elkészítve' })
}
