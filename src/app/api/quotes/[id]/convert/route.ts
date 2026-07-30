import { NextRequest, NextResponse } from 'next/server'
import { convertQuoteToOrder } from '@/lib/quoteToOrder'

export const dynamic = 'force-dynamic'

// Ajánlat átgörgetése vevői megrendelésbe. Ugyanazt a közös függvényt hívja,
// mint az MCP convert_quote_to_order tool.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))

  const result = await convertQuoteToOrder(params.id, {
    deliveryDate:    body?.deliveryDate,
    deliveryAddress: body?.deliveryAddress,
    shippingMethod:  body?.shippingMethod,
    customerRef:     body?.customerRef,
    notes:           body?.notes,
  })

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return NextResponse.json({ error: 'Az ajánlat nem található.' }, { status: 404 })
    }
    if (result.reason === 'no_items') {
      return NextResponse.json(
        { error: `A(z) ${result.quoteNumber} ajánlatnak nincs tétele, így nem alakítható megrendeléssé.` },
        { status: 400 },
      )
    }
    // Már át lett görgetve — nem hiba, csak nem csinálunk másodikat.
    return NextResponse.json({
      ok: true,
      alreadyConverted: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      message: `A(z) ${result.quoteNumber} ajánlatból már készült megrendelés: ${result.orderNumber}`,
    })
  }

  return NextResponse.json({ ok: true, order: result.order }, { status: 201 })
}
