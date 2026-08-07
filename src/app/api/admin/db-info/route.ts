import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// Melyik adatbázishoz kapcsolódik ez az app? Csak a SZOLGÁLTATÓT és a
// hosztnevet mutatja — felhasználónév/jelszó SOHA nem kerül a válaszba.
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const raw = process.env.DATABASE_URL ?? ''
  let host = '(nincs DATABASE_URL)'
  let database = '?'
  let provider = 'ismeretlen'

  try {
    const u = new URL(raw)
    host = u.hostname
    database = u.pathname.replace(/^\//, '') || '?'
    provider =
      /supabase\.(co|com)$/.test(host) || host.includes('supabase') ? 'Supabase'
      : host.includes('neon.tech') ? 'Neon'
      : host.includes('railway') ? 'Railway'
      : host.includes('vercel-storage') || host.includes('prisma-postgres') ? 'Vercel Postgres'
      : host.includes('amazonaws') ? 'AWS (RDS?)'
      : host === 'localhost' ? 'Lokális'
      : 'egyéb'
  } catch { /* rossz vagy hiányzó URL */ }

  // Élő-e a kapcsolat, és mennyi adat van benne?
  let alive = false
  let counts: Record<string, number> | { hiba: string } = { hiba: 'nem sikerült lekérdezni' }
  try {
    const [emails, threads, companies, contacts, tasks] = await Promise.all([
      prisma.email.count(), prisma.emailThread.count(),
      prisma.company.count(), prisma.contact.count(), prisma.task.count(),
    ])
    alive = true
    counts = { levelek: emails, levelszalak: threads, cegek: companies, kontaktok: contacts, feladatok: tasks }
  } catch (e) {
    counts = { hiba: e instanceof Error ? e.message.slice(0, 200) : String(e) }
  }

  return NextResponse.json({
    provider,
    host,
    database,
    kapcsolatEl: alive,
    tartalom: counts,
    megjegyzes: 'A felhasználónév és a jelszó szándékosan nem jelenik meg.',
  })
}
