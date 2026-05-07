import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function generateOrderNumber() {
  const year = new Date().getFullYear()
  const prefix = `MR-${year}-`
  const last = await prisma.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
  })
  const next = last ? parseInt(last.number.split('-')[2]) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const source = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await prisma.order.create({
    data: {
      number: await generateOrderNumber(),
      date: new Date(),
      status: 'pending',
      notes: source.notes,
      internalNotes: source.internalNotes,
      customerRef: source.customerRef,
      deliveryAddress: source.deliveryAddress,
      contactId: source.contactId,
      companyId: source.companyId,
      subtotal: source.subtotal,
      vatAmount: source.vatAmount,
      total: source.total,
      items: {
        create: source.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          total: i.total,
          productId: i.productId || null,
        })),
      },
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: true,
    },
  })

  return NextResponse.json(order, { status: 201 })
}
