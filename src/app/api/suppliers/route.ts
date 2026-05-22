import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { carriers: true, purchaseOrders: true } },
    },
  })
  return NextResponse.json(suppliers)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      zip: body.zip || null,
      country: body.country || 'DE',
      website: body.website || null,
      vatId: body.vatId || null,
      notes: body.notes || null,
    },
    include: { _count: { select: { carriers: true, purchaseOrders: true } } },
  })
  return NextResponse.json(supplier, { status: 201 })
}
