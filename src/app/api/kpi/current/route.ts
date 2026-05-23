import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const year = now.getFullYear()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const monthStart = new Date(year, now.getMonth(), 1)
  const monthEnd = new Date(year, now.getMonth() + 1, 1)
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const [
    annualRevResult,
    monthlyRevResult,
    openInvResult,
    newPartnersResult,
    ordersResult,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: 'paid', paidAt: { gte: yearStart, lt: yearEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: 'paid', paidAt: { gte: monthStart, lt: monthEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ['open', 'sent'] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.company.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: yearStart, lt: yearEnd }, status: { notIn: ['cancelled'] } },
      _sum: { total: true },
      _count: true,
    }),
  ])

  const activePartnerRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT id)::int AS count FROM "Company"
    WHERE id IN (
      SELECT DISTINCT "companyId" FROM "Invoice"
      WHERE "companyId" IS NOT NULL AND "date" >= ${twelveMonthsAgo}
      UNION
      SELECT DISTINCT "companyId" FROM "Order"
      WHERE "companyId" IS NOT NULL AND "createdAt" >= ${twelveMonthsAgo}
    )
  `

  const reorderRows = await prisma.$queryRaw<{ companyId: string; cnt: bigint }[]>`
    SELECT "companyId", COUNT(*) AS cnt
    FROM "Invoice"
    WHERE status = 'paid'
      AND "paidAt" >= ${yearStart}
      AND "companyId" IS NOT NULL
    GROUP BY "companyId"
  `

  const annualRevenue = annualRevResult._sum.total ?? 0
  const monthlyRevenue = monthlyRevResult._sum.total ?? 0
  const openInvoicesValue = openInvResult._sum.total ?? 0
  const openInvoicesCount = openInvResult._count
  const activePartners = Number(activePartnerRows[0]?.count ?? 0)
  const newPartnersMonth = newPartnersResult
  const avgOrderValue = ordersResult._count > 0
    ? (ordersResult._sum.total ?? 0) / ordersResult._count
    : 0
  const totalWithOrders = reorderRows.length
  const totalWithReorders = reorderRows.filter(r => Number(r.cnt) >= 2).length
  const reorderRate = totalWithOrders > 0 ? (totalWithReorders / totalWithOrders) * 100 : 0

  // Monthly revenue breakdown for trend (current year, all months up to now)
  const monthlyBreakdown = await prisma.$queryRaw<{ m: number; revenue: number }[]>`
    SELECT EXTRACT(MONTH FROM "paidAt")::int AS m, COALESCE(SUM(total), 0)::float AS revenue
    FROM "Invoice"
    WHERE status = 'paid'
      AND "paidAt" >= ${yearStart}
      AND "paidAt" < ${yearEnd}
    GROUP BY m
    ORDER BY m
  `

  return NextResponse.json({
    annualRevenue,
    monthlyRevenue,
    openInvoicesValue,
    openInvoicesCount,
    activePartners,
    newPartnersMonth,
    avgOrderValue,
    reorderRate,
    monthlyBreakdown,
    year,
    month: now.getMonth() + 1,
    calculatedAt: now.toISOString(),
  })
}
