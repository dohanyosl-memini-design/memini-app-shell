import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const dn = await prisma.deliveryNote.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      company: true,
      items: { include: { product: true } },
    },
  })
  if (!dn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(dn)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  if (body.items) {
    const items = body.items as { description: string; quantity: number; unitPrice: number; vatRate: number; isDiscount?: boolean; productId?: string }[]
    const subtotal = items.filter(i => !i.isDiscount).reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const discountTotal = items.filter(i => i.isDiscount).reduce((s, i) => s + Math.abs(i.unitPrice), 0)
    const net = subtotal - discountTotal
    const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
    const total = net + vatAmount

    await prisma.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: params.id } })
    const dn = await prisma.deliveryNote.update({
      where: { id: params.id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        deliveryInfo: body.deliveryInfo ?? null,
        notes: body.notes ?? null,
        billingName: body.billingName ?? null,
        billingAddress: body.billingAddress ?? null,
        billingZip: body.billingZip ?? null,
        billingCity: body.billingCity ?? null,
        billingCountry: body.billingCountry ?? null,
        contactId: body.contactId || null,
        companyId: body.companyId || null,
        subtotal,
        vatAmount,
        total,
        items: {
          create: items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            vatRate: i.vatRate,
            total: i.isDiscount ? -Math.abs(i.unitPrice) : i.quantity * i.unitPrice,
            isDiscount: i.isDiscount ?? false,
            productId: i.productId || null,
          })),
        },
      },
      include: { contact: true, company: true, items: true },
    })
    return NextResponse.json(dn)
  }

  if (body.status !== undefined) {
    const dn = await prisma.deliveryNote.update({
      where: { id: params.id },
      data: { status: body.status },
      include: { contact: true, company: true, items: true },
    })
    return NextResponse.json(dn)
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.deliveryNote.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
