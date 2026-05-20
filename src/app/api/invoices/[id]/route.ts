import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      company: true,
      items: { include: { product: true } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  // Full invoice edit (items provided)
  if (body.items) {
    const items = body.items as { description: string; quantity: number; unitPrice: number; vatRate: number; isDiscount?: boolean; productId?: string }[]
    const subtotal = items.filter(i => !i.isDiscount).reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const discountTotal = items.filter(i => i.isDiscount).reduce((s, i) => s + Math.abs(i.quantity * i.unitPrice), 0)
    const net = subtotal - discountTotal
    const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
    const total = net + vatAmount

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } })
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
            total: i.quantity * i.unitPrice,
            isDiscount: i.isDiscount ?? false,
            productId: i.productId || null,
          })),
        },
      },
      include: { contact: true, company: true, items: true },
    })
    return NextResponse.json(invoice)
  }

  // Status-only update
  if (body.status !== undefined) {
    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { company: true, contact: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: body.status,
        paidAt: body.status === 'paid' ? new Date() : null,
      },
      include: { contact: true, company: true, items: true },
    })

    if (body.status === 'paid') {
      // Create income transaction (avoid duplicate)
      const already = await prisma.transaction.findFirst({ where: { reference: existing.number } })
      if (!already) {
        const who = existing.company?.name || (existing.contact ? `${existing.contact.firstName} ${existing.contact.lastName}` : null)
        await prisma.transaction.create({
          data: {
            type: 'income',
            amount: existing.total,
            currency: existing.currency,
            date: new Date(),
            description: who ? `Számla: ${existing.number} – ${who}` : `Számla: ${existing.number}`,
            category: 'Értékesítés',
            reference: existing.number,
          },
        })
      }
    } else if (existing.status === 'paid') {
      // Status changed away from paid → remove the auto-created transaction
      await prisma.transaction.deleteMany({ where: { reference: existing.number, type: 'income' } })
    }

    return NextResponse.json(invoice)
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.invoice.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
