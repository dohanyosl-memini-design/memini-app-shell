import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ ok: false, message: 'Már van felhasználó, setup nem szükséges.' })
  }

  const users = [
    { name: 'Gabi', email: 'gabi@memini.de', password: 'memini2024!', role: 'admin' },
    { name: 'Laci', email: 'laci@memini.de', password: 'memini2024!', role: 'user' },
  ]

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12)
    await prisma.user.create({
      data: { name: u.name, email: u.email, password: hashed, role: u.role },
    })
  }

  return NextResponse.json({
    ok: true,
    message: 'Felhasználók létrehozva! Ezt az URL-t töröld le a kódból, vagy ne hívd meg többé.',
    users: users.map((u) => ({ name: u.name, email: u.email, password: u.password })),
  })
}
