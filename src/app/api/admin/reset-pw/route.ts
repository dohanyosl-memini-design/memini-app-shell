import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, active: true, role: true },
    })

    if (users.length === 0) {
      // No users exist — create them now with known password
      const hash = await bcrypt.hash('Memini2025!', 12)
      await prisma.user.create({
        data: { name: 'Laci', email: 'dohanyosl@gmail.com', password: hash, role: 'admin', active: true },
      })
      await prisma.user.create({
        data: { name: 'Gabi', email: 'gabriella.fekete88@gmail.com', password: hash, role: 'admin', active: true },
      })
      return NextResponse.json({ status: 'users_created', password: 'Memini2025!', users: ['dohanyosl@gmail.com', 'gabriella.fekete88@gmail.com'] })
    }

    // Users exist — reset all passwords
    const hash = await bcrypt.hash('Memini2025!', 12)
    await prisma.user.updateMany({ data: { password: hash, active: true } })

    return NextResponse.json({ status: 'passwords_reset', password: 'Memini2025!', users })
  } catch (e) {
    return NextResponse.json({ status: 'error', error: String(e) }, { status: 500 })
  }
}
