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
  const todayStr = today.toLocaleDateString('de-DE')
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [overdueInvoices, openInvoices, recentDeliveries, pendingDeals, existingTasks] = await Promise.all([
    prisma.invoice.findMany({
      where: { dueDate: { lt: today }, status: { in: ['open', 'sent'] } },
      include: { company: { select: { id: true, name: true, email: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ['open', 'sent'] } },
      include: { company: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.deliveryNote.findMany({
      where: {
        status: 'sent',
        date: { lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      include: { company: { select: { id: true, name: true, email: true } } },
    }),
    prisma.deal.findMany({
      where: { stage: { notIn: ['won', 'lost'] } },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'asc' },
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

  const dataContext = `
Mai dátum: ${todayStr}

MEGLÉVŐ NYITOTT FELADATOK (${existingTasks.length} db):
${existingTasks.map(t => `- [${t.priority}] ${t.title}${t.company ? ` | ${t.company.name}` : ''}${t.dueDate ? ` | határidő: ${new Date(t.dueDate).toLocaleDateString('de-DE')}` : ''} | státusz: ${t.status}`).join('\n') || 'Nincs nyitott feladat'}

LEJÁRT SZÁMLÁK (${overdueInvoices.length} db):
${overdueInvoices.map(i => `- ${i.number} | ${i.company?.name || ''} | ${i.total.toFixed(2)} € | lejárt: ${new Date(i.dueDate).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs'}

NYITOTT SZÁMLÁK (${openInvoices.length} db):
${openInvoices.map(i => `- ${i.number} | ${i.company?.name || ''} | ${i.total.toFixed(2)} € | határidő: ${new Date(i.dueDate).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs'}

3+ NAPJA KISZÁLLÍTOTT — follow-up szükséges (${recentDeliveries.length} db):
${recentDeliveries.map(d => `- ${d.number} | ${d.company?.name || ''} | kiszállítva: ${new Date(d.date).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs'}

AKTÍV DEALEK (${pendingDeals.length} db):
${pendingDeals.map(d => `- ${d.company?.name || ''} | ${d.stage} | utoljára: ${new Date(d.updatedAt).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs'}
`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Te Arthur vagy, a Memini Design AI asszisztense.

Az alábbi adatok alapján:
1. Írj egy rövid napi összefoglalót MAGYARUL (3-5 mondat)
2. Adj meg max 5 konkrét feladatot JSON formátumban amit létre kell hozni

FONTOS: A feladatokat csak akkor javasolj ha tényleg szükséges — ne duplikáld a már meglévő feladatokat!

${dataContext}

Válaszolj PONTOSAN ebben a JSON formátumban:
{
  "summary": "A napi összefoglaló szövege itt...",
  "tasks": [
    {
      "title": "Feladat megnevezése",
      "description": "Részletek, context",
      "priority": "high|medium|low",
      "dueDays": 1,
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

  // Feladatok létrehozása az adatbázisban
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
      type: 'daily',
      title: `Napi jelentés – ${todayStr}`,
      summary: parsed.summary || text,
      drafts: parsed.drafts || [],
    },
  })

  return NextResponse.json({
    ok: true,
    message: 'Napi jelentés elkészítve',
    tasksCreated: createdTasks.length,
    tasks: createdTasks,
  })
}
