import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const users = [
    {
      name: 'Laci',
      email: 'dohanyosl@gmail.com',
      password: '$2b$12$W2rQ/VrVrKzJO/s./uNLa.3KqX86FVICCglYECksE.PxgsPW8hZei',
      role: 'admin',
    },
    {
      name: 'Gabi',
      email: 'gabriella.fekete88@gmail.com',
      password: '$2b$12$TgmaVDPGYNfJL3y.13hPmOdVE1mddmVCfS.cwtEAZnBJkeBM5ODKu',
      role: 'admin',
    },
  ]

  const results = []
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) {
      results.push({ email: u.email, status: 'már létezik' })
      continue
    }
    await prisma.user.create({ data: u })
    results.push({ email: u.email, status: 'létrehozva' })
  }

  return NextResponse.json({ ok: true, results })
}
