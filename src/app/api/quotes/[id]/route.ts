import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      company: { select: { id: true, name: true, address: true, city: true, vatId: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

  await prisma.quoteItem.deleteMany({ where: { quoteId: params.id } })

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      status: body.status,
      notes: body.notes || null,
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
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: true,
    },
  })

  return NextResponse.json(quote)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.quote.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
