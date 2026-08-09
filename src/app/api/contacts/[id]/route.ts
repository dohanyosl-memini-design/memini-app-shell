import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      company: true,
      deals: { orderBy: { createdAt: 'desc' } },
      tasks: { where: { status: { not: 'completed' } }, orderBy: { dueDate: 'asc' } },
      activities: { orderBy: { activityDate: 'desc' }, take: 50 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: {
      salutation: body.salutation || null,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      status: body.status,
      notes: body.notes || null,
      companyId: body.companyId || null,
      // Visszaállítás archívumból: ha restore=true, töröljük az archiválást.
      ...(body.restore ? { archivedAt: null, archiveReason: null } : {}),
    },
    include: { company: true },
  })

  return NextResponse.json(contact)
}

// A kuka gomb SOHA nem töröl — archivál. Az archivált kapcsolat eltűnik az
// aktív listákból, de minden kapcsolódó adata (email, aktivitás, számla)
// megmarad és visszaállítható. Az indok opcionális.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  let reason: string | null = null
  try {
    const body = await request.json()
    reason = (body?.reason || '').trim() || null
  } catch {
    // üres body — indok nélkül is archiválható
  }

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: { archivedAt: new Date(), archiveReason: reason },
  })
  return NextResponse.json({ success: true, archived: true, id: contact.id })
}
