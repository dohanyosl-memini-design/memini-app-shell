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
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const weekStr = `${weekAgo.toLocaleDateString('de-DE')} – ${today.toLocaleDateString('de-DE')}`

  const [weekInvoices, topCompanies, activeDeals, recentOrders, existingTasks] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: weekAgo } },
      include: { company: { select: { name: true } } },
    }),
    prisma.company.findMany({
      include: {
        invoices: { where: { status: 'paid', paidAt: { gte: weekAgo } }, select: { total: true } },
        _count: { select: { orders: true } },
      },
      take: 10,
    }),
    prisma.deal.findMany({
      where: { stage: { notIn: ['won', 'lost'] } },
      include: { company: { select: { id: true, name: true, city: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekAgo } },
      include: { company: { select: { name: true } } },
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

  const weekRevenue = weekInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const weekOpen = weekInvoices.filter(i => ['open', 'sent'].includes(i.status)).reduce((s, i) => s + i.total, 0)

  const dataContext = `
Mai dátum: ${today.toLocaleDateString('de-DE')}
Időszak: ${weekStr}

MEGLÉVŐ NYITOTT FELADATOK (${existingTasks.length} db):
${existingTasks.map(t => `- [${t.priority}] ${t.title}${t.company ? ` | ${t.company.name}` : ''}${t.dueDate ? ` | határidő: ${new Date(t.dueDate).toLocaleDateString('de-DE')}` : ''} | státusz: ${t.status}`).join('\n') || 'Nincs nyitott feladat'}

HETI BEVÉTEL:
- Befolyt (fizetett): ${weekRevenue.toFixed(2)} €
- Nyitott (várható): ${weekOpen.toFixed(2)} €
- Új számlák száma: ${weekInvoices.length} db

ÚJ MEGRENDELÉSEK: ${recentOrders.length} db
${recentOrders.map(o => `- ${o.number} | ${o.company?.name || ''}`).join('\n') || 'Nincs'}

AKTÍV DEALEK / PARTNERTÁRGYALÁSOK (${activeDeals.length} db):
${activeDeals.map(d => `- ${d.company?.name || ''} (${d.company?.city || ''}) | ${d.stage} | értéke: ${d.value ? d.value.toFixed(2) + ' €' : 'ismeretlen'}`).join('\n') || 'Nincs'}

TOP CÉGEK (rendelések alapján):
${topCompanies.filter(c => c._count.orders > 0).slice(0, 5).map(c => `- ${c.name}: ${c._count.orders} rendelés`).join('\n') || 'Nincs adat'}
`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Te Arthur vagy, a Memini Design AI asszisztense. A Memini Design helyspecifikus souvenir hűtőmágneseket értékesít B2B partnereknek Ulm központtal.

Az alábbi adatok alapján:
1. Írj egy heti összefoglalót MAGYARUL (5-8 mondat, tartalmazza: bevétel, rendelések, dealek, prioritások)
2. Adj meg max 5 konkrét feladatot JSON formátumban amit létre kell hozni

FONTOS: A feladatokat csak akkor javasolj ha tényleg szükséges — ne duplikáld a már meglévő feladatokat!

${dataContext}

Válaszolj PONTOSAN ebben a JSON formátumban:
{
  "summary": "A heti összefoglaló szövege itt...",
  "tasks": [
    {
      "title": "Feladat megnevezése",
      "description": "Részletek, context",
      "priority": "high|medium|low",
      "dueDays": 7,
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

  const createdTasks: string[] = []
  if (parsed.tasks && parsed.tasks.length > 0) {
    for (const task of parsed.tasks) {
      const dueDate = task.dueDays
        ? new Date(Date.now() + task.dueDays * 24 * 60 * 60 * 1000)
        : in7days

      const created = await prisma.task.create({
        data: {
          title: task.title,
          description: task.description || null,
          priority: task.priority || 'medium',
          dueDate,
          status: 'pending',
          taskType: 'arthur',
          companyId: task.companyId || null,
        },
      })
      createdTasks.push(created.title)
    }
  }

  await prisma.arthurReport.create({
    data: {
      type: 'weekly',
      title: `Heti jelentés – ${weekStr}`,
      summary: parsed.summary || text,
      drafts: parsed.drafts || [],
    },
  })

  return NextResponse.json({
    ok: true,
    message: 'Heti jelentés elkészítve',
    tasksCreated: createdTasks.length,
    tasks: createdTasks,
  })
}
