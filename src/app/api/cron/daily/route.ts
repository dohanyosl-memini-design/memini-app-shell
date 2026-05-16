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

  // Adatok összegyűjtése
  const [overdueInvoices, openInvoices, recentDeliveries, pendingDeals] = await Promise.all([
    prisma.invoice.findMany({
      where: { dueDate: { lt: today }, status: { in: ['open', 'sent'] } },
      include: { company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
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
      include: { company: { select: { name: true, email: true } } },
    }),
    prisma.deal.findMany({
      where: { stage: { notIn: ['won', 'lost'] } },
      include: { company: { select: { name: true } } },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
  ])

  const dataContext = `
Mai dátum: ${todayStr}

LEJÁRT SZÁMLÁK (${overdueInvoices.length} db):
${overdueInvoices.map(i => `- ${i.number} | ${i.company?.name || 'Ismeretlen'} | ${i.total.toFixed(2)} € | lejárt: ${new Date(i.dueDate).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs lejárt számla'}

NYITOTT SZÁMLÁK (${openInvoices.length} db):
${openInvoices.map(i => `- ${i.number} | ${i.company?.name || ''} | ${i.total.toFixed(2)} € | határidő: ${new Date(i.dueDate).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs nyitott számla'}

3+ NAPJA KISZÁLLÍTOTT CSOMAGOK — follow-up szükséges (${recentDeliveries.length} db):
${recentDeliveries.map(d => `- ${d.number} | ${d.company?.name || ''} | kiszállítva: ${new Date(d.date).toLocaleDateString('de-DE')} | email: ${d.company?.email || 'nincs'}`).join('\n') || 'Nincs ilyen'}

AKTÍV DEALEK / PARTNERTÁRGYALÁSOK (${pendingDeals.length} db):
${pendingDeals.map(d => `- ${d.company?.name || ''} | státusz: ${d.stage} | utoljára módosítva: ${new Date(d.updatedAt).toLocaleDateString('de-DE')}`).join('\n') || 'Nincs aktív deal'}
`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Te Arthur vagy, a Memini Design AI asszisztense. Laci és Gabi helyspecifikus souvenir hűtőmágneseket értékesítenek B2B partnereknek (kastélyok, múzeumok, templomok, stb.) Ulm központtal, Németországban.

Az alábbi adatok alapján készítsd el a mai napi jelentést MAGYARUL:

${dataContext}

A jelentés tartalmazzon:
1. **Mai összefoglaló** — mi a legfontosabb ma (2-3 mondat)
2. **Azonnali teendők** — prioritás szerint, pontokban
3. **Előkészített levelek** — ha van lejárt számla vagy kiszállított csomag, készíts VÁZLAT email szövegeket NÉMETÜL a partnereknek (csak vázlat, Laci dönt a küldésről)

Az email vázlatoknál adj meg: Kinek (cég neve), Tárgy (Betreff), és a levél szövege.
Légy konkrét, rövid, nem sablonos. A Memini Design nem nyomulós — értékalapú, emberi kommunikáció.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Levél vázlatok kinyerése (egyszerű struktúra)
  const drafts = []
  if (overdueInvoices.length > 0) {
    drafts.push({
      type: 'payment_reminder',
      count: overdueInvoices.length,
      note: 'Lejárt számla emlékeztető vázlatok az összefoglalóban',
    })
  }
  if (recentDeliveries.length > 0) {
    drafts.push({
      type: 'delivery_followup',
      count: recentDeliveries.length,
      note: 'Szállítás utáni follow-up vázlatok az összefoglalóban',
    })
  }

  await prisma.arthurReport.create({
    data: {
      type: 'daily',
      title: `Napi jelentés – ${todayStr}`,
      summary: text,
      drafts,
    },
  })

  return NextResponse.json({ ok: true, message: 'Napi jelentés elkészítve' })
}
