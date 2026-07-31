import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { exportAllData } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Kézi, PIN-védett teljes mentés letöltése. A tartalom a Prisma modellekből
// jön (exportAllData), így minden tábla — a jövőben hozzáadottak is —
// automatikusan benne van.
export async function POST(request: NextRequest) {
  const { pin } = await request.json() as { pin: string }

  const stored = process.env.BACKUP_PIN
  if (!stored) {
    return NextResponse.json({ error: 'A BACKUP_PIN nincs beállítva a szerveren.' }, { status: 503 })
  }
  if (pin !== stored) {
    return NextResponse.json({ error: 'Helytelen PIN kód.' }, { status: 401 })
  }

  const backup = await exportAllData()
  const json = JSON.stringify(backup, null, 2)
  const filename = `memini-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
