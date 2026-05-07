import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const include = {
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  company: { select: { id: true, name: true, address: true, city: true, region: true, country: true, phone: true, email: true, vatId: true, customerNumber: true } },
  items: { include: { product: { select: { id: true, name: true, nameDE: true, sku: true, imageUrl: true, locationCabinet: true, locationShelf: true, locationBox: true } } } },
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({ where: { id: params.id }, include })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const items = (body.items || []) as {
    description: string; quantity: number; unitPrice: number; vatRate: number; productId?: string
  }[]

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  // Delete old items and recreate
  await prisma.orderItem.deleteMany({ where: { orderId: params.id } })

  const order = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: body.status,
      notes: body.notes || null,
      internalNotes: body.internalNotes || null,
      customerRef: body.customerRef || null,
      deliveryAddress: body.deliveryAddress || null,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
      shippingMethod: body.shippingMethod || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
      subtotal,
      vatAmount,
      total,
      items: {
        create: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          total: i.quantity * i.unitPrice * (1 + i.vatRate / 100),
          productId: i.productId || null,
        })),
      },
    },
    include,
  })

  return NextResponse.json(order)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.order.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
