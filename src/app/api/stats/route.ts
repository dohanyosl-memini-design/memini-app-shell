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
    paidInvoicesThisMonth,
    paidInvoicesLastMonth,
    allPaidInvoices,
    expensesThisMonth,
    expensesLastMonth,
    allBookkeepingExpenses,
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
    // Paid invoices this month (for income)
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { gte: startOfMonth } },
      select: { total: true, paidAt: true },
    }),
    // Paid invoices last month
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      select: { total: true, paidAt: true },
    }),
    // All paid invoices for cashflow chart
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { total: true, paidAt: true, currency: true, number: true, company: { select: { name: true } } },
      orderBy: { paidAt: 'asc' },
    }),
    // Expenses this month
    prisma.expense.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalAmount: true, amount: true },
    }),
    // Expenses last month
    prisma.expense.aggregate({
      where: { date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { totalAmount: true, amount: true },
    }),
    // All expenses for cashflow chart
    prisma.expense.findMany({
      orderBy: { date: 'asc' },
      select: { date: true, totalAmount: true, amount: true, category: true, currency: true },
    }),
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

  // Combined income: Transactions + paid invoices
  const invoiceIncomeThisMonth = paidInvoicesThisMonth.reduce((s, i) => s + i.total, 0)
  const invoiceIncomeLastMonth = paidInvoicesLastMonth.reduce((s, i) => s + i.total, 0)
  const expenseSumThisMonth = expensesThisMonth._sum.totalAmount || expensesThisMonth._sum.amount || 0
  const expenseSumLastMonth = expensesLastMonth._sum.totalAmount || expensesLastMonth._sum.amount || 0

  const combinedMonthlyIncome = (monthlyIncome._sum.amount || 0) + invoiceIncomeThisMonth
  const combinedMonthlyExpenses = (monthlyExpenses._sum.amount || 0) + expenseSumThisMonth
  const combinedLastMonthIncome = (lastMonthIncome._sum.amount || 0) + invoiceIncomeLastMonth
  const combinedLastMonthExpenses = (lastMonthExpenses._sum.amount || 0) + expenseSumLastMonth

  // Build combined cashflow entries for chart
  type CfEntry = { type: 'income' | 'expense'; amount: number; date: string; category: string | null }
  const allCashflowEntries: CfEntry[] = [
    ...allTransactions.map(t => ({ type: t.type as 'income' | 'expense', amount: t.amount, date: t.date instanceof Date ? t.date.toISOString() : String(t.date), category: t.category })),
    ...allPaidInvoices.map(inv => ({ type: 'income' as const, amount: inv.total, date: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : String(inv.paidAt), category: 'Értékesítés' })),
    ...allBookkeepingExpenses.map(exp => ({ type: 'expense' as const, amount: exp.totalAmount > 0 ? exp.totalAmount : exp.amount, date: exp.date instanceof Date ? exp.date.toISOString() : String(exp.date), category: exp.category })),
  ]

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
    combinedMonthlyIncome,
    combinedMonthlyExpenses,
    combinedLastMonthIncome,
    combinedLastMonthExpenses,
    allCashflowEntries,
  })
}
