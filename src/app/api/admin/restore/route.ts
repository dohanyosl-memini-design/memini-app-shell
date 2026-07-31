import { NextRequest, NextResponse } from 'next/server'
import { restoreAllData, type BackupFile, type RestoreMode } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Visszaállítás a közös, önmagát karbantartó modullal (restoreAllData).
// A táblák sorrendjét a modul a Prisma kapcsolatokból számolja, így nem kell
// kézzel karbantartani — új tábla automatikusan a helyére kerül.
//   - 'full': előbb üríti a táblákat, majd betölt.
//   - 'safe': csak beszúr, meglévőt nem bánt.
// A 2.0 (régi) és 3.0 (új) mentés-formátumot is elfogadja.
export async function POST(request: NextRequest) {
  const body = await request.json() as { backup: BackupFile; mode: RestoreMode; pin: string }
  const { backup, mode, pin } = body

  const stored = process.env.BACKUP_PIN
  if (!stored) {
    return NextResponse.json({ error: 'A BACKUP_PIN nincs beállítva a szerveren.' }, { status: 503 })
  }
  if (pin !== stored) {
    return NextResponse.json({ error: 'Helytelen PIN kód.' }, { status: 401 })
  }
  if (!backup?.data || !backup?.meta) {
    return NextResponse.json({ error: 'Érvénytelen backup fájl' }, { status: 400 })
  }

  const result = await restoreAllData(backup, mode === 'full' ? 'full' : 'safe')

  if (!result.ok) {
    return NextResponse.json({ error: result.error, inserted: result.inserted }, { status: 500 })
  }

  const total = Object.values(result.inserted).reduce((s, n) => s + n, 0)
  return NextResponse.json({ ok: true, mode: result.mode, results: result.inserted, total })
}
