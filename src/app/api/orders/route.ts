import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { promoteToPartnerIfNeeded } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const companyId = searchParams.get('companyId')
  const status = searchParams.get('status')

  const orders = await prisma.order.findMany({
    where: {
      ...(contactId ? { contactId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const items = (body.items || []) as {
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
    productId?: string
  }[]

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  const order = await prisma.order.create({
    data: {
      number: await generateOrderNumber(),
      date: body.date ? new Date(body.date) : new Date(),
      status: body.status || 'pending',
      notes: body.notes || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
      quoteId: body.quoteId || null,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
      shippingMethod: body.shippingMethod || null,
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
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: true,
    },
  })

  // Partnerré az első rendelés tesz — a cég átlép partnerbe, ha még nem az.
  await promoteToPartnerIfNeeded(order.companyId, 'ui')

  return NextResponse.json(order, { status: 201 })
}
