import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true, address: true, city: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const order = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: body.status,
      notes: body.notes || null,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
    },
  })

  return NextResponse.json(order)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.order.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
