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
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekStr = `${weekAgo.toLocaleDateString('de-DE')} – ${today.toLocaleDateString('de-DE')}`

  const [weekInvoices, topCompanies, activeDeals, recentOrders] = await Promise.all([
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
      include: { company: { select: { name: true, city: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekAgo } },
      include: { company: { select: { name: true } } },
    }),
  ])

  const weekRevenue = weekInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const weekOpen = weekInvoices.filter(i => ['open', 'sent'].includes(i.status)).reduce((s, i) => s + i.total, 0)

  const dataContext = `
Időszak: ${weekStr}

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
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Te Arthur vagy, a Memini Design AI asszisztense. A Memini Design helyspecifikus souvenir hűtőmágneseket értékesít B2B partnereknek Ulm központtal.

Az alábbi adatok alapján készítsd el a heti jelentést MAGYARUL:

${dataContext}

A jelentés tartalmazzon:
1. **Heti összefoglaló** — mi történt ezen a héten (bevétel, rendelések, tárgyalások)
2. **Jövő heti prioritások** — mit kell megcsinálni a következő 7 napban, konkrétan
3. **Partner fókusz** — melyik 2-3 partnerre/dealre kell koncentrálni és miért
4. **Gyenge pontok** — mi csúszik, mi van lemaradva

Légy konkrét és rövid. Ne írj üres frázisokat.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  await prisma.arthurReport.create({
    data: {
      type: 'weekly',
      title: `Heti jelentés – ${weekStr}`,
      summary: text,
      drafts: [],
    },
  })

  return NextResponse.json({ ok: true, message: 'Heti jelentés elkészítve' })
}
