import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadSyncConfig } from '@/lib/email/syncConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel felső korlát — a szinkron ehhez igazodik

// IMAP → CRM levél-szinkron végpont. A cPanel cron ezt "böki meg" 5 percenként
// egy curl-lel; a nehéz munka (Prisma) a Vercelen fut, ahol minden adott.
//
//   curl "https://<app>/api/sync/email?limit=40" -H "Authorization: Bearer <CRON_SECRET>"
//
// Query:
//   limit    — hívásonként feldolgozott levelek felső korlátja (alap: 40)
//   backfill — a kezdeti behúzás ablaka (levél/mappa); nagyobb érték az első
//              feltöltéshez, pl. ?backfill=1000&limit=200
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 40), 1), 300)
  const backfill = searchParams.get('backfill') ? Number(searchParams.get('backfill')) : undefined
  // Idő-budget: a szinkron magától megáll ennyi mp után (a Vercel 504 előtt).
  const maxSeconds = Math.min(Math.max(Number(searchParams.get('maxSeconds') ?? 50), 5), 55)

  const logs: string[] = []
  const log = (msg: string, extra?: Record<string, unknown>) =>
    logs.push(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`)

  try {
    const config = loadSyncConfig()
    // A nehéz csomagokat (imapflow/mailparser) futásidőben, a try-n BELÜL
    // töltjük — így egy esetleges betöltési hiba is olvasható JSON-ként jön
    // vissza, nem néma 500-ként.
    const { EmailSyncService } = await import('@/lib/email/sync')
    const service = new EmailSyncService(prisma, config, log)

    // Diagnosztika: ?folders=1 — az összes mappa listája, darabszámmal és a
    // legfrissebb levél dátumával. Nem szinkronizál, csak megmutatja, hová
    // érkezik a friss mail.
    if (searchParams.get('folders')) {
      const folders = await service.listFolders()
      return NextResponse.json({ ok: true, folders })
    }

    // ?restart=1 — a kurzort a mappák elejére állítja, hogy a RÉGI levelek is
    // bejöjjenek (a dedup miatt duplikátum nem lesz). Egyszer kell, utána a
    // normál hívások folytatják, amíg végig nem ér.
    const restart = !!searchParams.get('restart')
    const processed = await service.syncOnce({
      backfillLimit: backfill, maxMessages: limit, maxSeconds, restart,
    })
    return NextResponse.json({
      ok: true,
      processed,
      capped: processed >= limit, // ha true: van még hátra, a következő hívás folytatja
      logs,
      warning: secret ? undefined : 'Állíts be CRON_SECRET-et a végpont védelméhez.',
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    const missingEnv = /Hiányzó környezeti változó/.test(err.message)
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        hint: missingEnv
          ? 'Egy IMAP-környezeti változó hiányzik a Vercelen — ellenőrizd a Settings → Environment Variables listát, majd Redeploy.'
          : 'A hibaüzenet felül olvasható. Gyakori okok: rossz jelszó/host, vagy a levélszerver nem enged kapcsolódni.',
        logs,
      },
      { status: missingEnv ? 503 : 500 },
    )
  }
}

// GET és POST is működik — a curl bármelyikkel hívhatja.
export const GET = run
export const POST = run
