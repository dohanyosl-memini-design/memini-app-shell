import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city')
  const search = searchParams.get('search')

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(city && city !== 'all' ? { city } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { nameDE: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { material: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      nameDE: true,
      sku: true,
      description: true,
      material: true,
      productType: true,
      city: true,
      salesPrice: true,
      unit: true,
      vatRate: true,
      imageUrl: true,
      priceListEntryId: true,
    },
  })

  const cities = await prisma.product.findMany({
    where: { active: true, city: { not: null } },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })

  return NextResponse.json({
    products,
    cities: cities.map((c) => c.city).filter(Boolean),
  })
}
