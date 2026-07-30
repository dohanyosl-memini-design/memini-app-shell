import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarize, itemRows, type QuoteItemInput } from '@/lib/quoteItems'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      company: {
        select: {
          id: true, name: true, address: true, zip: true, city: true, country: true,
          vatId: true, phone: true, email: true, customerNumber: true,
        },
      },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const data: Record<string, unknown> = {}

  // Csak a ténylegesen megadott mezőket írjuk. Ez fontos: a listából érkező
  // státuszváltás csak a státuszt küldi, és korábban ilyenkor a tételek
  // törlődtek, az összegek pedig nullázódtak.
  if (body.number !== undefined) {
    const number = String(body.number).trim()
    const clash = await prisma.quote.findFirst({
      where: { number, NOT: { id: params.id } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json({ error: `A(z) ${number} ajánlatszám már foglalt.` }, { status: 409 })
    }
    data.number = number
  }
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null
  if (body.status !== undefined) data.status = body.status
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.contactId !== undefined) data.contactId = body.contactId || null
  if (body.companyId !== undefined) data.companyId = body.companyId || null
  if (body.billingName !== undefined) data.billingName = body.billingName || null
  if (body.billingAddress !== undefined) data.billingAddress = body.billingAddress || null
  if (body.billingZip !== undefined) data.billingZip = body.billingZip || null
  if (body.billingCity !== undefined) data.billingCity = body.billingCity || null
  if (body.billingCountry !== undefined) data.billingCountry = body.billingCountry || null

  // A tételeket csak akkor cseréljük, ha kaptunk tétellistát.
  if (Array.isArray(body.items)) {
    const items = body.items as QuoteItemInput[]
    const { subtotal, vatAmount, total } = summarize(items)
    data.subtotal = subtotal
    data.vatAmount = vatAmount
    data.total = total
    await prisma.quoteItem.deleteMany({ where: { quoteId: params.id } })
    data.items = { create: itemRows(items) }
  }

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data,
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
