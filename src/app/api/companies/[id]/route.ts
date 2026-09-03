import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transitionCompany, LifecycleError } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: { firstName: 'asc' } },
      deals: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { activityDate: 'desc' }, take: 50 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      tasks: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] },
      lifecycleEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const company = await prisma.company.update({
    where: { id: params.id },
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
    },
    include: { _count: { select: { contacts: true, deals: true } } },
  })

  return NextResponse.json(company)
}

// A kuka gomb SOHA nem töröl — a temetőbe rak. Az elvesztett állapotot (és a
// kötelező indokot) a lifecycle réteg érvényesíti. A törlés helyett a hívó a
// body-ban megadja az indokot; az ex-partner / ex-lead megkülönböztetést a
// rendelés-előzményből vezetjük le.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  let reason = ''
  let forceArchive = false
  try {
    const body = await request.json()
    reason = (body?.reason || '').trim()
    forceArchive = !!body?.forceArchive
  } catch {
    // üres/hiányzó body — a lifecycle réteg úgyis elutasítja indok nélkül
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { firstOrderDate: true, lifecycle: true },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 4. alapszabály: kint lévő eszközzel partnert nem archiválunk csendben. A
  // temetőbe rakás nem tüntetheti el, hogy fizikailag még nálunk van kint eszköz.
  // Tudatos felülírással (forceArchive) átléphető, de alapból tiltunk.
  if (!forceArchive) {
    const outPlacements = await prisma.assetPlacement.count({
      where: { companyId: params.id, status: { in: ['out', 'partially_returned'] } },
    })
    if (outPlacements > 0) {
      return NextResponse.json({
        error: `Ennél a partnernél még ${outPlacements} kihelyezés van kint. Előbb vedd vissza az eszközöket, vagy erősítsd meg az archiválást.`,
        code: 'assets_out',
        outPlacements,
      }, { status: 409 })
    }
  }

  // Volt-e valaha rendelés → elvesztett partner, különben elvesztett lead.
  const wasPartner = !!company.firstOrderDate || company.lifecycle === 'partner' || company.lifecycle === 'inactive'
  const target = wasPartner ? 'lost_partner' : 'lost_lead'

  try {
    await transitionCompany({ companyId: params.id, to: target, reason, source: 'ui' })
    return NextResponse.json({ success: true, movedTo: target })
  } catch (e) {
    if (e instanceof LifecycleError) {
      const status = e.code === 'reason_required' ? 400 : e.code === 'not_found' ? 404 : 409
      return NextResponse.json({ error: e.message, code: e.code }, { status })
    }
    throw e
  }
}
