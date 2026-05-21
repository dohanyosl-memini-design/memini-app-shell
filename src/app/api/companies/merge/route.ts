import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/companies/merge
// body: { masterId: string, duplicateIds: string[] }
// Moves all relations from duplicates → master, then deletes duplicates.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { masterId, duplicateIds } = body as { masterId: string; duplicateIds: string[] }

  if (!masterId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
    return NextResponse.json({ error: 'masterId and duplicateIds required' }, { status: 400 })
  }
  if (duplicateIds.includes(masterId)) {
    return NextResponse.json({ error: 'masterId cannot be in duplicateIds' }, { status: 400 })
  }

  const master = await prisma.company.findUnique({ where: { id: masterId } })
  if (!master) return NextResponse.json({ error: 'Master company not found' }, { status: 404 })

  for (const dupId of duplicateIds) {
    const dup = await prisma.company.findUnique({ where: { id: dupId } })
    if (!dup) continue

    await prisma.$transaction([
      prisma.invoice.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.contact.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.deal.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.activity.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.quote.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.order.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.task.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
      prisma.deliveryNote.updateMany({ where: { companyId: dupId }, data: { companyId: masterId } }),
    ])

    // Merge non-empty fields from dup into master (only if master field is empty)
    const patch: Record<string, string> = {}
    const fields = ['phone', 'email', 'website', 'address', 'zip', 'city', 'region', 'vatId', 'customerNumber', 'notes'] as const
    for (const f of fields) {
      if (!master[f] && dup[f]) patch[f] = dup[f] as string
    }
    if (Object.keys(patch).length > 0) {
      await prisma.company.update({ where: { id: masterId }, data: patch })
    }

    await prisma.company.delete({ where: { id: dupId } })
  }

  const result = await prisma.company.findUnique({
    where: { id: masterId },
    include: { _count: { select: { contacts: true, deals: true, orders: true, invoices: true } } },
  })

  return NextResponse.json({ success: true, company: result })
}
