import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const now = new Date()
  const thisYear = now.getFullYear()
  const lastYear = thisYear - 1
  const twoYearsAgo = thisYear - 2

  const orderItems = await prisma.orderItem.findMany({
    where: { productId: params.id },
    include: { order: { select: { date: true, status: true } } },
  })

  function sumYear(year: number) {
    const items = orderItems.filter(i => {
      const d = new Date(i.order.date)
      return d.getFullYear() === year && i.order.status !== 'cancelled'
    })
    return {
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      revenue: items.reduce((s, i) => s + i.total, 0),
      orderCount: new Set(items.map(i => i.orderId)).size,
    }
  }

  const movements = await prisma.stockMovement.findMany({
    where: { productId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    thisYear: { year: thisYear, ...sumYear(thisYear) },
    lastYear: { year: lastYear, ...sumYear(lastYear) },
    twoYearsAgo: { year: twoYearsAgo, ...sumYear(twoYearsAgo) },
    recentMovements: movements,
  })
}
