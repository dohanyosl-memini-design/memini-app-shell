import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { collectDailyFacts } from '@/lib/dailyFacts'
import { saveJournal } from '@/lib/dailyJournal'
import { localDay, dayToDbDate } from '@/lib/localDay'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Napi szerveroldali TÉNYMENTÉS — biztonsági háló.
 *
 * Korábban ez a végpont maga hívott AI-t, összefoglalót íratott és feladatokat
 * gyártott. Ezt a munkát ma Arthur végzi (négy napi futásban), méghozzá jobban:
 * ő a postafiókot is látja. A kettő párhuzamosan futva két, egymásról nem tudó
 * teendőlistát eredményezett.
 *
 * Ami maradt: a tegnapi nap tényeit lementjük a naplóba. Ha Arthur esti futása
 * elmaradt vagy hibára futott, a nap így sem vész el — a tények megvannak,
 * csak a narratíva hiányzik. Mellékhatásként az adatbázist is ébren tartja.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A tegnapi (már lezárult) napot mentjük — a mai még alakul.
  const day = localDay(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const facts = await collectDailyFacts({ day })

  const existing = await prisma.dailyJournal.findUnique({ where: { date: dayToDbDate(day) } })
  const arthurClosedIt = Boolean(existing?.closedAt)

  await saveJournal({
    day,
    facts,
    // Csak akkor hagyunk nyomot, ha a háló tényleg fogott valamit: ha Arthur
    // rendben lezárta a napot, ne szemeteljük tele a naplót napi bejegyzéssel.
    checkpoint: arthurClosedIt
      ? undefined
      : { label: 'Szerveroldali ténymentés', note: 'A nap nem lett lezárva — a tények mentve, narratíva nélkül.' },
  })

  return NextResponse.json({
    ok: true,
    day,
    arthurClosedIt,
    message: arthurClosedIt
      ? 'A napot Arthur lezárta; a tények frissítve.'
      : 'A nap nem volt lezárva — tények mentve biztonsági hálóként.',
  })
}
