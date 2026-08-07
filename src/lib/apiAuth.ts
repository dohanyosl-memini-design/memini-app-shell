import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Szerveroldali jogosultság-ellenőrzés API-útvonalakhoz.
 *
 * A session-cookie meglétét a middleware már ellenőrzi minden nem-kivett
 * útvonalon — de a SZEREPKÖRT nem. Az admin- és seed-műveleteket (adatmigráció,
 * tömeges seed, HubSpot-import) ezért itt kötjük admin joghoz, különben bármely
 * bejelentkezett `user` fiók is futtathatná őket.
 */

export interface SessionUser {
  id?: string
  role?: string
  email?: string | null
}

/** A bejelentkezett felhasználó, vagy null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as SessionUser) ?? null
}

/**
 * Admin jogot követel. Ha nincs bejelentkezve → 401, ha nem admin → 403.
 * Használat: `const denied = await requireAdmin(); if (denied) return denied`
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Ehhez adminisztrátori jog szükséges.' }, { status: 403 })
  }
  return null
}
