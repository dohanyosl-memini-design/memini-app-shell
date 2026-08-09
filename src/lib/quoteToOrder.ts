/**
 * Ajánlat → vevői megrendelés átgörgetés.
 *
 * Szándékosan közös: az MCP tool (convert_quote_to_order) és a felület
 * „Megrendelésre" gombja is ezt hívja. Ha két külön implementáció lenne,
 * idővel biztosan szétcsúsznának.
 */

import { prisma } from '@/lib/prisma'
import { promoteToPartnerIfNeeded } from '@/lib/lifecycle'

export async function nextOrderNumber() {
  const prefix = `MR-${new Date().getFullYear()}-`
  const last = await prisma.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    // Csak a number oszlopot olvassuk: így a lekérdezés nem függ a tábla többi
    // (esetleg még nem migrált) oszlopától.
    select: { number: true },
  })
  const next = last ? parseInt(last.number.split('-')[2]) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export async function nextQuoteNumber() {
  const prefix = `AJ-${new Date().getFullYear()}-`
  const last = await prisma.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const next = last ? parseInt(last.number.split('-')[2]) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export interface ConvertOptions {
  deliveryDate?: string
  deliveryAddress?: string
  shippingMethod?: string
  customerRef?: string
  notes?: string
}

export type ConvertResult =
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'no_items'; quoteNumber: string }
  | { ok: false; reason: 'already_converted'; quoteNumber: string; orderNumber: string; orderId: string }
  | { ok: true; quoteNumber: string; order: Awaited<ReturnType<typeof createOrderFromQuote>> }

async function createOrderFromQuote(
  quote: { id: string; contactId: string | null; companyId: string | null; currency: string
           subtotal: number; vatAmount: number; total: number; notes: string | null
           items: { description: string; quantity: number; unitPrice: number; vatRate: number
                    total: number; productId: string | null }[] },
  options: ConvertOptions,
) {
  return prisma.order.create({
    data: {
      number:          await nextOrderNumber(),
      date:            new Date(),
      status:          'pending',
      notes:           options.notes ?? quote.notes,
      customerRef:     options.customerRef || null,
      deliveryAddress: options.deliveryAddress || null,
      deliveryDate:    options.deliveryDate ? new Date(options.deliveryDate) : null,
      shippingMethod:  options.shippingMethod || null,
      contactId:       quote.contactId,
      companyId:       quote.companyId,
      quoteId:         quote.id,
      currency:        quote.currency,
      subtotal:        quote.subtotal,
      vatAmount:       quote.vatAmount,
      total:           quote.total,
      items: {
        create: quote.items.map(i => ({
          description: i.description,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          vatRate:     i.vatRate,
          total:       i.total,
          productId:   i.productId,
        })),
      },
    },
    include: { contact: true, company: true, items: true },
  })
}

/**
 * Egy ajánlatból legfeljebb EGY megrendelés születhet. Ha a partner kétszer
 * szól, vagy kétszer kattintunk, a második hívás nem csinál új rendelést,
 * hanem visszaadja a meglévőt.
 */
export async function convertQuoteToOrder(
  quoteId: string,
  options: ConvertOptions = {},
): Promise<ConvertResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  })
  if (!quote) return { ok: false, reason: 'not_found' }
  if (quote.items.length === 0) return { ok: false, reason: 'no_items', quoteNumber: quote.number }

  const existing = await prisma.order.findFirst({
    where: { quoteId: quote.id },
    select: { id: true, number: true },
  })
  if (existing) {
    return {
      ok: false,
      reason: 'already_converted',
      quoteNumber: quote.number,
      orderNumber: existing.number,
      orderId: existing.id,
    }
  }

  const order = await createOrderFromQuote(quote, options)
  await prisma.quote.update({ where: { id: quote.id }, data: { status: 'accepted' } })

  // Partnerré az első rendelés tesz — az ajánlatból született rendelés is számít.
  await promoteToPartnerIfNeeded(order.companyId, 'ui')

  return { ok: true, quoteNumber: quote.number, order }
}
