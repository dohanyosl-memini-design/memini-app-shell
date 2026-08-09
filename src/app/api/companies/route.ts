import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LEAD_STATES, PARTNER_STATES, LOST_STATES } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'

// A nézet dönti el, mely életciklus-állapotok látszanak. Alapból a Partner CRM
// (partner + inaktív) — így a hideg leadek és az elvesztettek nem keverednek ide.
//   view=partners (alap) | leads | cemetery | all
function lifecycleFilterForView(view: string, explicit: string) {
  if (explicit) return { lifecycle: explicit }
  switch (view) {
    case 'leads':    return { lifecycle: { in: LEAD_STATES } }
    case 'cemetery': return { lifecycle: { in: LOST_STATES } }
    case 'all':      return {}
    case 'partners':
    default:         return { lifecycle: { in: PARTNER_STATES } }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const partnerType = searchParams.get('partnerType') || ''
  const region = searchParams.get('region') || ''
  const country = searchParams.get('country') || ''
  const classification = searchParams.get('classification') || ''
  const language = searchParams.get('language') || ''
  const view = searchParams.get('view') || 'partners'
  const lifecycle = searchParams.get('lifecycle') || ''

  const [companies, lastActivityRows] = await Promise.all([
    prisma.company.findMany({
      where: {
        ...lifecycleFilterForView(view, lifecycle),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { city: { contains: search } },
            { email: { contains: search } },
          ],
        } : {}),
        ...(partnerType ? { partnerType } : {}),
        ...(region ? { region } : {}),
        ...(country ? { country } : {}),
        ...(classification ? { classification } : {}),
        ...(language ? { language } : {}),
      },
      include: {
        _count: { select: { contacts: true, deals: true, orders: true } },
        // Elsődleges (nem archivált) kapcsolattartó — a lead-kártyák ezt mutatják.
        contacts: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
      orderBy: [{ classification: 'asc' }, { name: 'asc' }],
    }),
    // Single query for last activity date per company — avoids N+1
    prisma.$queryRaw<{ companyId: string; lastActivityAt: Date }[]>`
      SELECT "companyId", MAX("activityDate") AS "lastActivityAt"
      FROM "Activity"
      WHERE "companyId" IS NOT NULL
      GROUP BY "companyId"
    `,
  ])

  const activityMap = new Map(lastActivityRows.map(r => [r.companyId, r.lastActivityAt]))

  const result = companies.map(c => ({
    ...c,
    activities: activityMap.has(c.id)
      ? [{ activityDate: activityMap.get(c.id)!.toISOString() }]
      : [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const company = await prisma.company.create({
    data: {
      name: body.name,
      partnerType: body.partnerType || null,
      industry: body.industry || null,
      website: body.website || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      zip: body.zip || null,
      city: body.city || null,
      region: body.region || null,
      country: body.country || 'DE',
      vatId: body.vatId || null,
      customerNumber: body.customerNumber || null,
      classification: body.classification || 'D',
      language: body.language || 'DE',
      channel: body.channel || null,
      notes: body.notes || null,
      businessHours: body.businessHours ?? undefined,
      // Új cég alapból prospekt — sose kerül a partnerek közé felvételkor.
      // Partnerré az első rendelés (vagy kézi léptetés) tesz.
      lifecycle: body.lifecycle || 'prospect',
    },
    include: { _count: { select: { contacts: true, deals: true, orders: true } } },
  })

  // A létrejövés naplózása, hogy a napló az első pillanattól teljes legyen.
  await prisma.lifecycleEvent.create({
    data: { companyId: company.id, fromState: null, toState: company.lifecycle, source: 'ui' },
  })

  return NextResponse.json({
    ...company,
    activities: [],
  }, { status: 201 })
}
