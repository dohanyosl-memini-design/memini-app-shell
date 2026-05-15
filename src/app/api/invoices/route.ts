import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const overdue = searchParams.get('overdue') === 'true'

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (overdue) {
    where.dueDate = { lt: new Date() }
    where.status = { in: ['open', 'sent'] }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true, address: true, zip: true, city: true, vatId: true, phone: true, email: true, customerNumber: true } },
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

  let number: string
  if (body.number && String(body.number).trim()) {
    number = String(body.number).trim()
    const conflict = await prisma.invoice.findFirst({ where: { number } })
    if (conflict) {
      return NextResponse.json({ error: `A(z) ${number} számlaszám már foglalt.` }, { status: 409 })
    }
  } else {
    const year = new Date().getFullYear()
    const lastInvoice = await prisma.invoice.findFirst({
      where: { number: { endsWith: `/${year}` }, stornoOf: null },
      orderBy: { createdAt: 'desc' },
    })
    const lastNum = lastInvoice ? parseInt(lastInvoice.number.split('/')[0] || '0') : 0
    number = `${String(lastNum + 1).padStart(2, '0')}/${year}`
  }

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date: body.date ? new Date(body.date) : new Date(),
      dueDate: new Date(body.dueDate),
      status: 'open',
      notes: body.notes || null,
      deliveryInfo: body.deliveryInfo || null,
      billingName: body.billingName || null,
      billingAddress: body.billingAddress || null,
      billingZip: body.billingZip || null,
      billingCity: body.billingCity || null,
      billingCountry: body.billingCountry || null,
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
          isDiscount?: boolean
        }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          total: item.isDiscount
            ? -(Math.abs(item.unitPrice))
            : item.quantity * item.unitPrice * (1 + item.vatRate / 100),
          isDiscount: item.isDiscount || false,
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

  // Auto-deduct stock for product items
  const productItems = body.items.filter(
    (item: { productId?: string; isDiscount?: boolean }) => item.productId && !item.isDiscount
  )
  if (productItems.length > 0) {
    await Promise.all(
      productItems.map((item: { productId: string; quantity: number }) =>
        prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              type: 'out',
              quantity: Math.round(item.quantity),
              reference: invoice.number,
              note: `Számla: ${invoice.number}`,
              productId: item.productId,
            },
          }),
          prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: Math.round(item.quantity) } },
          }),
        ])
      )
    )
  }

  return NextResponse.json(invoice, { status: 201 })
}
