import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const today = new Date()
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const monthStr = monthAgo.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const [monthInvoices, allCompanies, wonDeals, topProducts, existingTasks] = await Promise.all([
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
    prisma.task.findMany({
      where: { status: { in: ['pending', 'in_progress'] } },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 20,
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
Mai dátum: ${today.toLocaleDateString('de-DE')}
Hónap: ${monthStr}

MEGLÉVŐ NYITOTT FELADATOK (${existingTasks.length} db):
${existingTasks.map(t => `- [${t.priority}] ${t.title}${t.company ? ` | ${t.company.name}` : ''}${t.dueDate ? ` | határidő: ${new Date(t.dueDate).toLocaleDateString('de-DE')}` : ''} | státusz: ${t.status}`).join('\n') || 'Nincs nyitott feladat'}

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

Az alábbi adatok alapján:
1. Írj egy havi összefoglalót MAGYARUL (8-10 mondat, tartalmazza: bevétel, top partnerek, dealek, következő havi prioritások, stratégiai javaslat)
2. Adj meg max 5 konkrét feladatot JSON formátumban amit létre kell hozni

FONTOS: A feladatokat csak akkor javasolj ha tényleg szükséges — ne duplikáld a már meglévő feladatokat!

${dataContext}

Válaszolj PONTOSAN ebben a JSON formátumban:
{
  "summary": "A havi összefoglaló szövege itt...",
  "tasks": [
    {
      "title": "Feladat megnevezése",
      "description": "Részletek, context",
      "priority": "high|medium|low",
      "dueDays": 14,
      "companyId": "csak ha konkrét céghez kötődik, különben null"
    }
  ],
  "drafts": [
    {
      "to": "Cég neve",
      "subject": "Email tárgy németül",
      "body": "Email szövege németül"
    }
  ]
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  let parsed: {
    summary?: string
    tasks?: { title: string; description?: string; priority?: string; dueDays?: number; companyId?: string }[]
    drafts?: { to: string; subject: string; body: string }[]
  } = {}

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    parsed = { summary: text, tasks: [], drafts: [] }
  }

  // A feladatjavaslatok Arthurhoz kerültek: ő a postafiókot is látja, így nem
  // keletkezik két, egymásról nem tudó teendőlista. A jelentés marad.
  const createdTasks: string[] = []

  await prisma.arthurReport.create({
    data: {
      type: 'monthly',
      title: `Havi jelentés – ${monthStr}`,
      summary: parsed.summary || text,
      drafts: parsed.drafts || [],
    },
  })

  return NextResponse.json({
    ok: true,
    message: 'Havi jelentés elkészítve',
    tasksCreated: createdTasks.length,
    tasks: createdTasks,
  })
}
