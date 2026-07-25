import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailSyncService } from '@/lib/email/sync'
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

  let config
  try {
    config = loadSyncConfig()
  } catch (e) {
    // Hiányzó IMAP-env — értelmes üzenet, hogy a beállítás hiánya látszódjon.
    return NextResponse.json(
      { error: 'A levél-szinkron nincs beállítva.', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    )
  }

  const logs: string[] = []
  const log = (msg: string, extra?: Record<string, unknown>) =>
    logs.push(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`)

  try {
    const service = new EmailSyncService(prisma, config, log)
    const processed = await service.syncOnce({ backfillLimit: backfill, maxMessages: limit })
    return NextResponse.json({
      ok: true,
      processed,
      capped: processed >= limit, // ha true: van még hátra, a következő hívás folytatja
      logs,
      warning: secret ? undefined : 'Állíts be CRON_SECRET-et a végpont védelméhez.',
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), logs },
      { status: 500 },
    )
  }
}

// GET és POST is működik — a curl bármelyikkel hívhatja.
export const GET = run
export const POST = run
