import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const days180Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  const [
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    openInvoices,
    overdueInvoices,
    lowStockProducts,
    recentContacts,
    dealsByStage,
    contactsByStatus,
    upcomingTasks,
    monthlyIncome,
    monthlyExpenses,
    lastMonthIncome,
    lastMonthExpenses,
    allTransactions,
    topProducts,
    dormantCompanies,
    partnersByType,
    partnersByClassification,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.count({ where: { stage: { notIn: ['closed_won', 'closed_lost'] } } }),
    prisma.task.count({ where: { status: { not: 'completed' } } }),
    prisma.invoice.findMany({
      where: { status: 'open' },
      select: { total: true, dueDate: true, number: true },
    }),
    prisma.invoice.count({
      where: { status: 'open', dueDate: { lt: now } },
    }),
    prisma.product.findMany({
      where: { active: true, stock: { lte: prisma.product.fields.minStock } },
      select: { id: true, name: true, sku: true, stock: true, minStock: true },
    }),
    prisma.contact.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { company: true },
    }),
    prisma.deal.groupBy({ by: ['stage'], _count: true, _sum: { value: true } }),
    prisma.contact.groupBy({ by: ['status'], _count: true }),
    prisma.task.findMany({
      where: { status: { not: 'completed' }, dueDate: { gte: now } },
      take: 5,
      orderBy: { dueDate: 'asc' },
      include: { contact: true },
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
    prisma.transaction.findMany({
      orderBy: { date: 'asc' },
      select: { type: true, amount: true, date: true, category: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { stock: 'desc' },
      take: 5,
      select: { name: true, sku: true, stock: true, salesPrice: true },
    }),
    prisma.company.findMany({
      where: {
        orders: {
          some: { createdAt: { lt: days90Ago } },
          none: { createdAt: { gte: days90Ago } },
        },
      },
      select: { id: true, name: true, classification: true, partnerType: true, city: true },
      orderBy: { name: 'asc' },
      take: 10,
    }),
    prisma.company.groupBy({ by: ['partnerType'], _count: true }),
    prisma.company.groupBy({ by: ['classification'], _count: true }),
  ])

  const openInvoicesTotal = openInvoices.reduce((s, i) => s + i.total, 0)
  const wonRevenue = await prisma.transaction.aggregate({
    where: { type: 'income' },
    _sum: { amount: true },
  })

  return NextResponse.json({
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    openInvoicesTotal,
    openInvoicesCount: openInvoices.length,
    overdueInvoices,
    lowStockProducts,
    recentContacts,
    dealsByStage,
    contactsByStatus,
    upcomingTasks,
    monthlyIncome: monthlyIncome._sum.amount || 0,
    monthlyExpenses: monthlyExpenses._sum.amount || 0,
    lastMonthIncome: lastMonthIncome._sum.amount || 0,
    lastMonthExpenses: lastMonthExpenses._sum.amount || 0,
    totalRevenue: wonRevenue._sum.amount || 0,
    allTransactions,
    topProducts,
    dormantCompanies,
    partnersByType,
    partnersByClassification,
  })
}
