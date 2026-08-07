import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Egyszeri felhasználó-inicializálás. Ez az útvonal a middleware alól ki van
 * véve (különben nem lehetne belépés előtt lefuttatni), ezért két külön zár
 * védi, hogy ne lehessen visszaélni vele — se most, se ha a User tábla valaha
 * kiürül egy hibás visszaállítás után:
 *
 *   1. Csak akkor fut, ha egyáltalán nincs felhasználó.
 *   2. Csak a helyes SETUP_SECRET birtokában (a szerveren beállított env).
 *
 * A jelszavakat NEM a forráskód tartalmazza, hanem env-változók — így nem
 * kerülnek a repóba és a git-történetbe.
 */
export async function POST(request: NextRequest) {
  const setupSecret = process.env.SETUP_SECRET
  if (!setupSecret) {
    return NextResponse.json({ ok: false, message: 'A SETUP_SECRET nincs beállítva a szerveren — a setup letiltva.' }, { status: 503 })
  }

  const provided = request.headers.get('x-setup-secret') || request.nextUrl.searchParams.get('secret')
  if (provided !== setupSecret) {
    return NextResponse.json({ ok: false, message: 'Érvénytelen setup kulcs.' }, { status: 401 })
  }

  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ ok: false, message: 'Már van felhasználó, a setup nem szükséges.' }, { status: 409 })
  }

  const adminEmail = process.env.SETUP_ADMIN_EMAIL
  const adminPassword = process.env.SETUP_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { ok: false, message: 'Állítsd be a SETUP_ADMIN_EMAIL és SETUP_ADMIN_PASSWORD env-változókat.' },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(adminPassword, 12)
  const admin = await prisma.user.create({
    data: { name: process.env.SETUP_ADMIN_NAME || 'Admin', email: adminEmail.toLowerCase(), password: hashed, role: 'admin' },
  })

  // A választ NEM tartalmaz jelszót.
  return NextResponse.json({ ok: true, message: 'Admin felhasználó létrehozva.', user: { email: admin.email } })
}
