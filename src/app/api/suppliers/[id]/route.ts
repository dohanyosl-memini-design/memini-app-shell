import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      products: {
        where: { active: true },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, nameDE: true, sku: true, city: true,
          stock: true, minStock: true, unit: true, costPrice: true, imageUrl: true,
        },
      },
      purchaseOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
      },
    },
  })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(supplier)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const supplier = await prisma.supplier.update({
    where: { id: params.id },
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
      active: body.active ?? true,
    },
  })
  return NextResponse.json(supplier)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.supplier.update({
    where: { id: params.id },
    data: { active: false },
  })
  return NextResponse.json({ ok: true })
}
