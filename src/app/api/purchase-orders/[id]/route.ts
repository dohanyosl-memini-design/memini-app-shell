import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, nameDE: true, sku: true, unit: true, costPrice: true, city: true, imageUrl: true },
          },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: params.id } })

  const order = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      notes: body.notes ?? undefined,
      orderedAt: body.orderedAt ? new Date(body.orderedAt) : undefined,
      items: {
        create: (body.items as { productId: string; quantity: number; unitPrice: number; note?: string }[]).map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 0,
          note: item.note || null,
        })),
      },
    },
    include: {
      supplier: true,
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  })
  return NextResponse.json(order)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.purchaseOrder.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
