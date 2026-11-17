import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { defaultStore } from '@/lib/finance/originals'

export const dynamic = 'force-dynamic'

// Az eredeti fájl letöltése. A tároló privát, ezért a szerver olvassa és továbbítja —
// csak bejelentkezett felhasználónak (a middleware védi).
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.financialDocument.findUnique({ where: { id: params.id } })
  if (!doc?.storageUrl) return NextResponse.json({ error: 'Ehhez a dokumentumhoz nincs feltöltött eredeti.' }, { status: 404 })
  try {
    const blob = await defaultStore().get(doc.storageUrl)
    if (!blob) return NextResponse.json({ error: 'Az eredeti fájl nem található a tárolóban.' }, { status: 404 })
    const name = doc.originalFilename.replace(/[^\w.\-]+/g, '_')
    return new Response(blob.stream, {
      headers: {
        'Content-Type': doc.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
