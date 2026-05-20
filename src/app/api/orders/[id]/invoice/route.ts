import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const year = new Date().getFullYear()
  const lastInvoice = await prisma.invoice.findFirst({
    where: { number: { endsWith: `/${year}` }, stornoOf: null },
    orderBy: { createdAt: 'desc' },
  })
  const lastNum = lastInvoice ? parseInt(lastInvoice.number.split('/')[0] || '0') : 0
  const number = `${String(lastNum + 1).padStart(2, '0')}/${year}`

  const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = order.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date: new Date(),
      dueDate,
      status: 'open',
      notes: order.notes || null,
      contactId: order.contactId,
      companyId: order.companyId,
      subtotal,
      vatAmount,
      total,
      items: {
        create: order.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          total: i.total,
          productId: i.productId || null,
        })),
      },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
