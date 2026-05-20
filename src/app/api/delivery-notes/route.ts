import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''

  const deliveryNotes = await prisma.deliveryNote.findMany({
    where: status ? { status } : {},
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true, address: true, zip: true, city: true, country: true, vatId: true, phone: true, email: true, customerNumber: true } },
      items: { include: { product: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(deliveryNotes)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const subtotal = body.items
    .filter((i: { isDiscount?: boolean }) => !i.isDiscount)
    .reduce((s: number, i: { quantity: number; unitPrice: number }) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = body.items
    .filter((i: { isDiscount?: boolean }) => i.isDiscount)
    .reduce((s: number, i: { unitPrice: number }) => s + Math.abs(i.unitPrice), 0)
  const net = subtotal - discountTotal
  const vatAmount = body.items.reduce(
    (s: number, i: { quantity: number; unitPrice: number; vatRate: number }) =>
      s + i.quantity * i.unitPrice * (i.vatRate / 100),
    0
  )
  const total = net + vatAmount

  let number: string
  if (body.number && String(body.number).trim()) {
    number = String(body.number).trim()
    const conflict = await prisma.deliveryNote.findFirst({ where: { number } })
    if (conflict) {
      return NextResponse.json({ error: `A(z) ${number} szállítólevél szám már foglalt.` }, { status: 409 })
    }
  } else {
    const year = new Date().getFullYear()
    const last = await prisma.deliveryNote.findFirst({
      where: { number: { endsWith: `/${year}` } },
      orderBy: { createdAt: 'desc' },
    })
    const lastNum = last ? parseInt(last.number.replace('SL-', '').split('/')[0] || '0') : 0
    number = `SL-${String(lastNum + 1).padStart(2, '0')}/${year}`
  }

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      number,
      date: body.date ? new Date(body.date) : new Date(),
      deliveryInfo: body.deliveryInfo || null,
      status: 'draft',
      notes: body.notes || null,
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
          description: string; quantity: number; unitPrice: number
          vatRate: number; productId?: string; isDiscount?: boolean
        }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          total: item.isDiscount ? -Math.abs(item.unitPrice) : item.quantity * item.unitPrice,
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

  return NextResponse.json(deliveryNote, { status: 201 })
}
