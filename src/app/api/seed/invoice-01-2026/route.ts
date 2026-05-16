import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// One-time seed route: creates invoice 01/2026 (Evang. Gesamtkirchengemeinde Ulm)
// Safe to call multiple times – checks for existing invoice first
export async function GET() {
  // Check if already exists
  const existing = await prisma.invoice.findFirst({ where: { number: '01/2026' } })
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Invoice 01/2026 already exists', id: existing.id })
  }

  // Upsert company
  let company = await prisma.company.findFirst({
    where: { name: { contains: 'Gesamtkirchengemeinde Ulm' } },
  })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Evang. Gesamtkirchengemeinde Ulm',
        industry: 'Kirchlicher Souvenirladen / Besucherbetrieb',
        address: 'Münsterplatz 1',
        zip: '89073',
        city: 'Ulm',
        country: 'DE',
        customerNumber: '0010',
        language: 'DE',
        partnerType: 'customer',
      },
    })
  }

  // Upsert contact
  let contact = await prisma.contact.findFirst({
    where: { companyId: company.id, lastName: 'Ettrich' },
  })
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        salutation: 'Frau',
        firstName: '',
        lastName: 'Ettrich',
        email: 'i.ettrich@muensterbauamt-ulm.de',
        phone: '+49 731 9675014',
        companyId: company.id,
        status: 'customer',
      },
    })
  }

  // Exact product descriptions as on the original invoice (Rechnung 01/2026)
  const items = [
    {
      description: 'Graphitoptik - Steinmagnet, (groß)\nUlm - 37 / 01 (Münster mit Spatz)',
      quantity: 500, unitPrice: 2.72, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Graphitoptik - Steinmagnet,\nUlm - 39 / 01 (Münsterplatz)',
      quantity: 300, unitPrice: 2.59, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Laserschnitt - Kühlschrankmagnet,\nUlm - 07 / 02 (UlmSkyline)',
      quantity: 100, unitPrice: 2.97, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Mini - Kühlschrankmagnet,\nUlm - 40 / 18\nMünster mit der Spatz',
      quantity: 100, unitPrice: 1.79, vatRate: 19, isDiscount: false,
    },
    {
      description: 'Mini - Kühlschrankmagnet,\nUlm - 41 / 18\nMünster mit dem Drachen',
      quantity: 100, unitPrice: 1.82, vatRate: 19, isDiscount: false,
    },
  ]

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const total = subtotal + vatAmount

  const invoice = await prisma.invoice.create({
    data: {
      number: '01/2026',
      date: new Date('2026-01-21'),
      dueDate: new Date('2026-02-20'),
      status: 'paid',
      currency: 'EUR',
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      billingName: 'Evang. Gesamtkirchengemeinde Ulm\nBesucherbetrieb Ulmer Münster (Münstershop)',
      billingAddress: 'Münsterplatz 1',
      billingZip: '89073',
      billingCity: 'Ulm',
      billingCountry: 'DE',
      deliveryInfo: '21.01.2026',
      notes: 'Kunden-Nr.: 0010 | Zahlungsfrist: 30 Tage',
      companyId: company.id,
      contactId: contact.id,
      items: {
        create: items.map(i => ({
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
    message: 'Invoice 01/2026 created successfully',
    invoiceId: invoice.id,
    companyId: company.id,
    contactId: contact.id,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
  })
}
