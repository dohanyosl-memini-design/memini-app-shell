import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const entry = await prisma.priceListEntry.update({
    where: { id: params.id },
    data: {
      name: body.name,
      hordozo: body.hordozo || null,
      costPrice: parseFloat(body.costPrice) || 0,
      basePrice: parseFloat(body.basePrice) || 0,
      tiers: body.tiers || [],
      notes: body.notes || null,
      sortOrder: parseInt(body.sortOrder) || 0,
    },
  })
  return NextResponse.json(entry)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.priceListEntry.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ success: true })
}
