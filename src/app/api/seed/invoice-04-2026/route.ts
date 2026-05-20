import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// One-time seed route: creates invoice 04/2026 (Stadt Ulm – Die Einsteins Museum)
// Safe to call multiple times – checks for existing invoice first
export async function GET() {
  const existing = await prisma.invoice.findFirst({ where: { number: '04/2026' } })
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Invoice 04/2026 already exists', id: existing.id })
  }

  // Find or create company
  let company = await prisma.company.findFirst({
    where: { name: { contains: 'Einsteins' } },
  })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Stadt Ulm – Die Einsteins - Museum einer Ulmer Familie',
        address: 'Weinhof 12',
        zip: '89073',
        city: 'Ulm',
        country: 'DE',
        customerNumber: '0029',
        language: 'DE',
        partnerType: 'customer',
        email: 'einstein@ulm.de',
        phone: '+49 731 1614273',
      },
    })
  }

  // Find or create contact
  let contact = await prisma.contact.findFirst({
    where: { companyId: company.id, lastName: 'Presuhn' },
  })
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        salutation: 'Frau',
        firstName: 'Dr.',
        lastName: 'Presuhn',
        email: 'einstein@ulm.de',
        phone: '+49 731 1614273',
        companyId: company.id,
        status: 'customer',
      },
    })
  }

  const items = [
    {
      description: 'Graphitoptik - Steinmagnet,\nUlm - 02 / 01\nDonauufer',
      quantity: 50,
      unitPrice: 2.87,
      vatRate: 19,
      isDiscount: false,
    },
  ]

  const subtotal = 143.50
  const vatAmount = 27.27
  const total = 170.77

  const invoice = await prisma.invoice.create({
    data: {
      number: '04/2026',
      date: new Date('2026-03-24'),
      dueDate: new Date('2026-03-31'),
      status: 'paid',
      currency: 'EUR',
      subtotal,
      vatAmount,
      total,
      billingName: 'Stadt Ulm\nDie Einsteins - Museum einer Ulmer Familie',
      billingAddress: 'Weinhof 12',
      billingZip: '89073',
      billingCity: 'Ulm',
      billingCountry: 'DE',
      deliveryInfo: '24.03.2026',
      notes: 'Kunden-Nr.: 0029 | Zahlungsfrist: 7 Tage',
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
    message: 'Invoice 04/2026 created successfully',
    invoiceId: invoice.id,
    companyId: company.id,
    contactId: contact.id,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
  })
}
