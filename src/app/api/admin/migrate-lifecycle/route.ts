import { NextRequest, NextResponse } from 'next/server'
import { runLifecycleMigration } from '@/lib/lifecycleMigration'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Egyszeri életciklus-besorolás a meglévő cégekhez. A séma-bevezetés után minden
 * cég alapból `prospect` — ez a végpont sorolja be őket adatból (partner /
 * inaktív / érdeklődő / hideg lead / prospekt).
 *
 * Védelem: a SETUP_SECRET env-változó (ugyanaz, ami a setup-ot védi). Belépés
 * nem kell hozzá, ezért a middleware alól ki van véve — de a titok nélkül nem fut.
 *
 *   GET  ?secret=…            → riport (dry-run, nem ír)
 *   POST ?secret=… (&all=true) → tényleges besorolás
 */
function checkSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.SETUP_SECRET
  if (!secret) return NextResponse.json({ ok: false, message: 'SETUP_SECRET nincs beállítva a szerveren.' }, { status: 503 })
  const provided = request.headers.get('x-setup-secret') || request.nextUrl.searchParams.get('secret')
  if (provided !== secret) return NextResponse.json({ ok: false, message: 'Érvénytelen kulcs.' }, { status: 401 })
  return null
}

export async function GET(request: NextRequest) {
  const denied = checkSecret(request)
  if (denied) return denied
  const result = await runLifecycleMigration({ dryRun: true })
  return NextResponse.json({ ok: true, ...result, hint: 'Ez csak riport. A tényleges besoroláshoz POST-old ugyanezt az URL-t.' })
}

export async function POST(request: NextRequest) {
  const denied = checkSecret(request)
  if (denied) return denied
  const all = request.nextUrl.searchParams.get('all') === 'true'
  const result = await runLifecycleMigration({ dryRun: false, all })
  return NextResponse.json({ ok: true, ...result, message: `${result.total} cég besorolva.` })
}
