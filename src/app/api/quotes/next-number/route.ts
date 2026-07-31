import { NextResponse } from 'next/server'
import { nextQuoteNumber } from '@/lib/quoteToOrder'

export const dynamic = 'force-dynamic'

// A következő szabad ajánlatszám — az űrlap ezzel tölti ki előre a mezőt,
// a számla next-number végpontjának mintájára. A mező szerkeszthető marad.
export async function GET() {
  return NextResponse.json({ number: await nextQuoteNumber() })
}
