import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markQuoteSent } from '@/lib/quoteSend'

export const dynamic = 'force-dynamic'

// Az ajánlat kiküldöttre jelölése: státusz → sent, sentAt rögzítése, és
// utánkövető feladat felvétele. Ugyanezt hívja az MCP mark_quote_sent tool.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))
  const session = await getServerSession(authOptions).catch(() => null)
  const actor = session?.user?.email ?? 'human'

  const result = await markQuoteSent(params.id, actor, body?.followUpDays)

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return NextResponse.json({ error: 'Az ajánlat nem található.' }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      alreadySent: true,
      message: `A(z) ${result.quoteNumber} ajánlat már ki lett küldve (${result.sentAt.toLocaleDateString('hu-HU')}).`,
    })
  }

  return NextResponse.json({
    ok: true,
    quoteNumber: result.quoteNumber,
    followUpAt: result.followUpAt,
    taskId: result.taskId,
  })
}
