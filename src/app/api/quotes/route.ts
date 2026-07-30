import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextQuoteNumber } from '@/lib/quoteToOrder'
import { summarize, itemRows, type QuoteItemInput } from '@/lib/quoteItems'

export const dynamic = 'force-dynamic'

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
      company: {
        select: {
          id: true, name: true, address: true, zip: true, city: true,
          vatId: true, phone: true, email: true, customerNumber: true,
        },
      },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quotes)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const items = (body.items || []) as QuoteItemInput[]
  const { subtotal, vatAmount, total } = summarize(items)

  // A sorszám az űrlapon szerkeszthető; ha üresen jön, generálunk.
  const number = (body.number as string)?.trim() || (await nextQuoteNumber())

  const clash = await prisma.quote.findUnique({ where: { number }, select: { id: true } })
  if (clash) {
    return NextResponse.json({ error: `A(z) ${number} ajánlatszám már foglalt.` }, { status: 409 })
  }

  const quote = await prisma.quote.create({
    data: {
      number,
      date: body.date ? new Date(body.date) : new Date(),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      status: body.status || 'draft',
      notes: body.notes || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
      billingName: body.billingName || null,
      billingAddress: body.billingAddress || null,
      billingZip: body.billingZip || null,
      billingCity: body.billingCity || null,
      billingCountry: body.billingCountry || null,
      subtotal,
      vatAmount,
      total,
      items: { create: itemRows(items) },
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      items: true,
    },
  })

  return NextResponse.json(quote, { status: 201 })
}
