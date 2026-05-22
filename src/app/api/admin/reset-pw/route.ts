import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// Temporary password reset — DELETE THIS FILE after use!
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, active: true, role: true },
  })

  const tmpPassword = 'Memini2025!'
  const hash = await bcrypt.hash(tmpPassword, 12)

  await prisma.user.updateMany({ data: { password: hash, active: true } })

  return NextResponse.json({
    message: `Minden felhasználó jelszava átállítva: "${tmpPassword}" — bejelentkezés után azonnal változtasd meg!`,
    users,
  })
}
