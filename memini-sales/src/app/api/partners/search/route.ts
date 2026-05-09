import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ companies: [], contacts: [] })

  const [companies, contacts] = await Promise.all([
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { customerNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 25,
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        classification: true,
        customerNumber: true,
      },
    }),
    prisma.contact.findMany({
      where: {
        companyId: null,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { lastName: 'asc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ])

  return NextResponse.json({ companies, contacts })
}
