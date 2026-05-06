import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''

  const invoices = await prisma.invoice.findMany({
    where: status ? { status } : {},
    include: {
      contact: true,
      company: true,
      items: { include: { product: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(invoices)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const subtotal = body.items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number }) =>
      sum + item.quantity * item.unitPrice,
    0
  )
  const vatAmount = body.items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number; vatRate: number }) =>
      sum + item.quantity * item.unitPrice * (item.vatRate / 100),
    0
  )
  const total = subtotal + vatAmount

  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { number: 'desc' },
  })
  const year = new Date().getFullYear()
  const lastNum = lastInvoice
    ? parseInt(lastInvoice.number.split('-')[2] || '0')
    : 0
  const number = `RE-${year}-${String(lastNum + 1).padStart(3, '0')}`

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date: body.date ? new Date(body.date) : new Date(),
      dueDate: new Date(body.dueDate),
      status: 'open',
      notes: body.notes || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
      currency: body.currency || 'EUR',
      subtotal,
      vatAmount,
      total,
      items: {
        create: body.items.map((item: {
          description: string
          quantity: number
          unitPrice: number
          vatRate: number
          productId?: string
        }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          total: item.quantity * item.unitPrice * (1 + item.vatRate / 100),
          productId: item.productId || null,
        })),
      },
    },
    include: {
      contact: true,
      company: true,
      items: { include: { product: true } },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
