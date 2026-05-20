import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const original = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, contact: true, company: true },
  })

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (original.status === 'cancelled') {
    return NextResponse.json({ error: 'Invoice is already cancelled' }, { status: 400 })
  }

  const stornoNumber = `K-${original.number}`

  const existing = await prisma.invoice.findFirst({ where: { number: stornoNumber } })
  if (existing) {
    return NextResponse.json({ error: 'Storno already exists' }, { status: 400 })
  }

  const [storno] = await prisma.$transaction([
    prisma.invoice.create({
      data: {
        number: stornoNumber,
        date: new Date(),
        dueDate: new Date(),
        status: 'cancelled',
        notes: `Stornorechnung zu Rechnung Nr. ${original.number}`,
        stornoOf: original.number,
        contactId: original.contactId,
        companyId: original.companyId,
        currency: original.currency,
        subtotal: -original.subtotal,
        vatAmount: -original.vatAmount,
        total: -original.total,
        items: {
          create: original.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: -Math.abs(item.unitPrice),
            vatRate: item.vatRate,
            total: -Math.abs(item.total),
            isDiscount: item.isDiscount,
            productId: item.productId,
          })),
        },
      },
      include: { contact: true, company: true, items: true },
    }),
    prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'cancelled' },
    }),
  ])

  return NextResponse.json(storno, { status: 201 })
}
