import { NextRequest, NextResponse } from 'next/server'
import { getJournal, listJournals, saveJournal } from '@/lib/dailyJournal'
import { isValidDay } from '@/lib/localDay'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const day = p.get('day')

  if (day) {
    if (!isValidDay(day)) return NextResponse.json({ error: 'Érvénytelen dátum' }, { status: 400 })
    const journal = await getJournal(day)
    if (!journal) return NextResponse.json({ error: 'Nincs napló erre a napra' }, { status: 404 })
    return NextResponse.json(journal)
  }

  const rows = await listJournals({
    from:  p.get('from') ?? undefined,
    to:    p.get('to')   ?? undefined,
    limit: p.get('limit') ? Number(p.get('limit')) : undefined,
  })
  return NextResponse.json(rows)
}

/** Kézi javítás a felületről — a narratívát felülírja, és emberi szerkesztésnek jelöli. */
export async function PUT(request: NextRequest) {
  const body = await request.json()
  if (!body.day || !isValidDay(body.day)) {
    return NextResponse.json({ error: 'Érvénytelen dátum' }, { status: 400 })
  }
  const journal = await saveJournal({
    day:           body.day,
    narrative:     body.narrative,
    narrativeMode: 'replace',
    priorities:    body.priorities,
    byUser:        true,
  })
  return NextResponse.json(journal)
}
