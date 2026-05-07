import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [
    openInvoices,
    overdueInvoices,
    allActiveProducts,
    monthlyIncome,
    monthlyExpenses,
    lastMonthIncome,
    lastMonthExpenses,
    totalRevenue,
    allTransactions,
    paidInvoicesByMonth,
    dormantCompanies,
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    dealsByStage,
    upcomingTasks,
    recentContacts,
    partnersByType,
    partnersByClassification,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'open' },
      select: { total: true, dueDate: true, number: true, company: { select: { name: true } } },
    }),
    prisma.invoice.count({
      where: { status: 'open', dueDate: { lt: now } },
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, salesPrice: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'income', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'income', date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'income' },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      orderBy: { date: 'asc' },
      select: { type: true, amount: true, date: true, category: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { total: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.company.findMany({
      where: { updatedAt: { lt: days90Ago } },
      select: { id: true, name: true, classification: true, city: true, partnerType: true },
      orderBy: { name: 'asc' },
      take: 8,
    }),
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.count({ where: { stage: { notIn: ['closed_won', 'closed_lost'] } } }),
    prisma.task.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
    prisma.deal.groupBy({
      by: ['stage'],
      _count: true,
      _sum: { value: true },
    }),
    prisma.task.findMany({
      where: { status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true, title: true, dueDate: true, priority: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, firstName: true, lastName: true, status: true, createdAt: true,
        company: { select: { name: true } },
      },
    }),
    prisma.company.groupBy({ by: ['partnerType'], _count: true }),
    prisma.company.groupBy({ by: ['classification'], _count: true }),
  ])

  const lowStockProducts = allActiveProducts.filter(p => p.stock <= p.minStock)
  const topProductsByValue = [...allActiveProducts]
    .sort((a, b) => (b.stock * b.salesPrice) - (a.stock * a.salesPrice))
    .slice(0, 6)

  const totalStockCostValue = allActiveProducts.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalStockSalesValue = allActiveProducts.reduce((s, p) => s + p.stock * p.salesPrice, 0)
  const openInvoicesTotal = openInvoices.reduce((s, i) => s + i.total, 0)

  const topProducts = [...allActiveProducts]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 6)

  return NextResponse.json({
    openInvoicesTotal,
    openInvoicesCount: openInvoices.length,
    overdueInvoices,
    openInvoicesList: openInvoices.slice(0, 5),
    lowStockProducts,
    topProductsByValue,
    topProducts,
    totalStockCostValue,
    totalStockSalesValue,
    monthlyIncome: monthlyIncome._sum.amount || 0,
    monthlyExpenses: monthlyExpenses._sum.amount || 0,
    lastMonthIncome: lastMonthIncome._sum.amount || 0,
    lastMonthExpenses: lastMonthExpenses._sum.amount || 0,
    totalRevenue: totalRevenue._sum.amount || 0,
    allTransactions,
    paidInvoicesByMonth,
    dormantCompanies,
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    dealsByStage,
    upcomingTasks,
    recentContacts,
    partnersByType,
    partnersByClassification,
  })
}
