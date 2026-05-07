import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function generateQuoteNumber() {
  const year = new Date().getFullYear()
  const prefix = `AJ-${year}-`
  const last = await prisma.quote.findFirst({
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

  const quotes = await prisma.quote.findMany({
    where: {
      ...(contactId ? { contactId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quotes)
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

  const quote = await prisma.quote.create({
    data: {
      number: await generateQuoteNumber(),
      date: body.date ? new Date(body.date) : new Date(),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      status: body.status || 'draft',
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

  return NextResponse.json(quote, { status: 201 })
}
