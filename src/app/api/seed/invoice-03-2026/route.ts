import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// One-time seed route: creates invoice 03/2026 (Milchpilz Lindau)
// Safe to call multiple times – checks for existing invoice first
export async function GET() {
  const existing = await prisma.invoice.findFirst({ where: { number: '03/2026' } })
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Invoice 03/2026 already exists', id: existing.id })
  }

  // Find or create company
  let company = await prisma.company.findFirst({
    where: { name: { contains: 'Milchpilz' } },
  })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Milchpilz Lindau',
        address: 'Sina-Kinkelin-Platz 1a',
        zip: '88131',
        city: 'Lindau-Insel',
        country: 'DE',
        customerNumber: '0032',
        language: 'DE',
        partnerType: 'customer',
        email: 'rechnung.milchpilz@gmail.com',
        phone: '+49 176 83802168',
      },
    })
  }

  // Find or create contact
  let contact = await prisma.contact.findFirst({
    where: { companyId: company.id, lastName: 'Schmok' },
  })
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        firstName: 'Nicolas',
        lastName: 'Schmok',
        email: 'rechnung.milchpilz@gmail.com',
        phone: '+49 176 83802168',
        companyId: company.id,
        status: 'customer',
      },
    })
  }

  // Exact product descriptions as on the original invoice
  // Note: Bodensee - 01/01 shows unit price 2,78€ on invoice but total 28,70€;
  // mathematically 28,70 / 10 = 2,87€ – stored as 2,87€ to match the Summe Netto 243,90€
  const productItems = [
    {
      description: 'Graphitoptik - Steinmagnet,\nLindau - 01 / 01\nAussichtsturm mit dem Schiff',
      quantity: 10, unitPrice: 2.87, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Aquarell - Steinmagnet,\nLindau - 02 / 01\nTurm im Hafen',
      quantity: 10, unitPrice: 3.73, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Aquarell - Steinmagnet,\nLindau - 03 / 01\nLindauer Möwe',
      quantity: 10, unitPrice: 3.73, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Aquarell - Steinmagnet,\nLindau - 06 / 01\nLindauer Sehenswürdigkeiten mit Blüten',
      quantity: 10, unitPrice: 3.73, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Aquarell - Steinmagnet,\nLindau - 07 / 01\nLindauer Leuchtturm',
      quantity: 10, unitPrice: 3.73, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Graphitoptik - Steinmagnet,\nBodensee - 01 / 01\nSegelboot auf dem See',
      quantity: 10, unitPrice: 2.87, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Aquarell - Steinmagnet,\nBodensee - 02 / 01\nSchiff auf dem See',
      quantity: 10, unitPrice: 3.73, vatRate: 19, isDiscount: false,
    },
  ]

  const discountItem = {
    description: '- 10% Neukunden - Rabatt\nbei Einzelproduktbestellungen',
    quantity: 1,
    unitPrice: 24.39,
    vatRate: 19,
    isDiscount: true,
  }

  const allItems = [...productItems, discountItem]

  // Totals from invoice: Summe Netto 219,51€ + MwSt 41,71€ = 261,22€
  const subtotal = 219.51
  const vatAmount = 41.71
  const total = 261.22

  const invoice = await prisma.invoice.create({
    data: {
      number: '03/2026',
      date: new Date('2026-03-10'),
      dueDate: new Date('2026-03-17'),
      status: 'paid',
      currency: 'EUR',
      subtotal,
      vatAmount,
      total,
      billingName: 'Milchpilz Lindau\nNicolas Schmok',
      billingAddress: 'Sina-Kinkelin-Platz 1a',
      billingZip: '88131',
      billingCity: 'Lindau-Insel',
      billingCountry: 'DE',
      deliveryInfo: '05.08.2025',
      notes: 'Kunden-Nr.: 0032 | Zahlungsfrist: 7 Tage',
      companyId: company.id,
      contactId: contact.id,
      items: {
        create: allItems.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          total: Math.round(i.quantity * i.unitPrice * 100) / 100,
          isDiscount: i.isDiscount,
        })),
      },
    },
  })

  return NextResponse.json({
    ok: true,
    message: 'Invoice 03/2026 created successfully',
    invoiceId: invoice.id,
    companyId: company.id,
    contactId: contact.id,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
  })
}
