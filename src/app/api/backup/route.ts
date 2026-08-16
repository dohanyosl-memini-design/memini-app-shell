import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { exportAllData } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Kézi, PIN-védett teljes mentés letöltése. A tartalom a Prisma modellekből
// jön (exportAllData), így minden tábla — a jövőben hozzáadottak is —
// automatikusan benne van.
export async function POST(request: NextRequest) {
  const { pin, probe } = await request.json() as { pin: string; probe?: boolean }

  const stored = process.env.BACKUP_PIN
  if (!stored) {
    return NextResponse.json({ error: 'A BACKUP_PIN nincs beállítva a szerveren.' }, { status: 503 })
  }
  if (pin !== stored) {
    return NextResponse.json({ error: 'Helytelen PIN kód.' }, { status: 401 })
  }

  try {
    const backup = await exportAllData()

    // Próba mód: csak a darabszámok és a méret jönnek vissza. Ha ez lefut,
    // de a teljes letöltés nem, akkor a méret a gond, nem a lekérdezés.
    const json = JSON.stringify(backup)
    if (probe) {
      return NextResponse.json({
        ok: true,
        meta: backup.meta,
        counts: backup.counts,
        bytes: Buffer.byteLength(json, 'utf8'),
      })
    }

    const filename = `memini-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    // Enélkül a kliens csak egy néma 500-at lát, és „hálózati hibát” ír ki.
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Az export megszakadt: ${message}` }, { status: 500 })
  }
}
