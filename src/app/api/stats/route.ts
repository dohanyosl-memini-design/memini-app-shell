import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
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
    // New: yearly data
    yearlyPaidInvoices,
    yearlyTransactionIncome,
    yearlyTransactionExpenses,
    yearlyBookkeepingExpenses,
    // New: warehouse
    stockSoldThisYear,
    stockPurchasedThisYear,
    totalStockCountAgg,
    // New: top customers
    topCustomerInvoices,
    // New: deals win/loss
    dealsWon,
    dealsLost,
    // New: avg payment time (paid invoices with date)
    paidInvoicesWithDates,
    // New: top selling products by invoice items
    topSoldProductItems,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'open' },
      select: { total: true, dueDate: true, number: true, company: { select: { name: true } } },
    }),
    prisma.invoice.count({ where: { status: 'open', dueDate: { lt: now } } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, salesPrice: true },
    }),
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'income' }, _sum: { amount: true } }),
    prisma.transaction.findMany({ orderBy: { date: 'asc' }, select: { type: true, amount: true, date: true, category: true } }),
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { not: null } }, select: { total: true, paidAt: true }, orderBy: { paidAt: 'asc' } }),
    prisma.company.findMany({ where: { updatedAt: { lt: days90Ago } }, select: { id: true, name: true, classification: true, city: true, partnerType: true }, orderBy: { name: 'asc' }, take: 8 }),
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.count({ where: { stage: { notIn: ['closed_won', 'closed_lost'] } } }),
    prisma.task.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
    prisma.deal.groupBy({ by: ['stage'], _count: true, _sum: { value: true } }),
    prisma.task.findMany({
      where: { status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      select: { id: true, title: true, dueDate: true, priority: true, contact: { select: { firstName: true, lastName: true } } },
    }),
    prisma.contact.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true, company: { select: { name: true } } },
    }),
    prisma.company.groupBy({ by: ['partnerType'], _count: true }),
    prisma.company.groupBy({ by: ['classification'], _count: true }),
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { gte: startOfMonth } }, select: { total: true, paidAt: true } }),
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, select: { total: true, paidAt: true } }),
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { not: null } }, select: { total: true, paidAt: true, currency: true, number: true, company: { select: { name: true } } }, orderBy: { paidAt: 'asc' } }),
    prisma.expense.aggregate({ where: { date: { gte: startOfMonth } }, _sum: { totalAmount: true, amount: true } }),
    prisma.expense.aggregate({ where: { date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { totalAmount: true, amount: true } }),
    prisma.expense.findMany({ orderBy: { date: 'asc' }, select: { date: true, totalAmount: true, amount: true, category: true, currency: true } }),
    // Yearly paid invoices
    prisma.invoice.findMany({ where: { status: 'paid', paidAt: { gte: startOfYear } }, select: { total: true, paidAt: true } }),
    // Yearly transaction income
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: startOfYear } }, _sum: { amount: true } }),
    // Yearly transaction expenses
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: startOfYear } }, _sum: { amount: true } }),
    // Yearly bookkeeping expenses
    prisma.expense.aggregate({ where: { date: { gte: startOfYear } }, _sum: { totalAmount: true, amount: true } }),
    // Stock sold this year (out movements)
    prisma.stockMovement.aggregate({ where: { type: 'out', createdAt: { gte: startOfYear } }, _sum: { quantity: true } }),
    // Stock purchased this year (in movements)
    prisma.stockMovement.aggregate({ where: { type: 'in', createdAt: { gte: startOfYear } }, _sum: { quantity: true } }),
    // Total stock count
    prisma.product.aggregate({ where: { active: true }, _sum: { stock: true } }),
    // Top customers: all paid invoices with customer info
    prisma.invoice.findMany({
      where: { status: 'paid' },
      select: { total: true, billingName: true, company: { select: { id: true, name: true } } },
    }),
    // Deal win/loss
    prisma.deal.count({ where: { stage: 'closed_won' } }),
    prisma.deal.count({ where: { stage: 'closed_lost' } }),
    // Paid invoices with date for avg payment time
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { date: true, paidAt: true },
    }),
    // Top selling products (invoice items with product, this year)
    prisma.invoiceItem.findMany({
      where: { productId: { not: null }, invoice: { date: { gte: startOfYear } } },
      select: { quantity: true, product: { select: { id: true, name: true, sku: true } } },
    }),
  ])

  // ── Derived calculations ──

  const lowStockProducts = allActiveProducts.filter(p => p.stock <= p.minStock)
  const topProductsByValue = [...allActiveProducts].sort((a, b) => (b.stock * b.salesPrice) - (a.stock * a.salesPrice)).slice(0, 6)
  const totalStockCostValue = allActiveProducts.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalStockSalesValue = allActiveProducts.reduce((s, p) => s + p.stock * p.salesPrice, 0)
  const openInvoicesTotal = openInvoices.reduce((s, i) => s + i.total, 0)
  const topProducts = [...allActiveProducts].sort((a, b) => b.stock - a.stock).slice(0, 6)

  // Combined monthly
  const invoiceIncomeThisMonth = paidInvoicesThisMonth.reduce((s, i) => s + i.total, 0)
  const invoiceIncomeLastMonth = paidInvoicesLastMonth.reduce((s, i) => s + i.total, 0)
  const expenseSumThisMonth = expensesThisMonth._sum.totalAmount || expensesThisMonth._sum.amount || 0
  const expenseSumLastMonth = expensesLastMonth._sum.totalAmount || expensesLastMonth._sum.amount || 0
  const combinedMonthlyIncome = (monthlyIncome._sum.amount || 0) + invoiceIncomeThisMonth
  const combinedMonthlyExpenses = (monthlyExpenses._sum.amount || 0) + expenseSumThisMonth
  const combinedLastMonthIncome = (lastMonthIncome._sum.amount || 0) + invoiceIncomeLastMonth
  const combinedLastMonthExpenses = (lastMonthExpenses._sum.amount || 0) + expenseSumLastMonth

  // Combined cashflow entries for chart
  type CfEntry = { type: 'income' | 'expense'; amount: number; date: string; category: string | null }
  const allCashflowEntries: CfEntry[] = [
    ...allTransactions.map(t => ({ type: t.type as 'income' | 'expense', amount: t.amount, date: t.date instanceof Date ? t.date.toISOString() : String(t.date), category: t.category })),
    ...allPaidInvoices.map(inv => ({ type: 'income' as const, amount: inv.total, date: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : String(inv.paidAt), category: 'Értékesítés' })),
    ...allBookkeepingExpenses.map(exp => ({ type: 'expense' as const, amount: exp.totalAmount > 0 ? exp.totalAmount : exp.amount, date: exp.date instanceof Date ? exp.date.toISOString() : String(exp.date), category: exp.category })),
  ]

  // ── Yearly totals ──
  const yearlyInvoiceIncome = yearlyPaidInvoices.reduce((s, i) => s + i.total, 0)
  const yearlyExpenseSum = yearlyBookkeepingExpenses._sum.totalAmount || yearlyBookkeepingExpenses._sum.amount || 0
  const yearlyIncome = (yearlyTransactionIncome._sum.amount || 0) + yearlyInvoiceIncome
  const yearlyExpenses = (yearlyTransactionExpenses._sum.amount || 0) + yearlyExpenseSum
  const yearlyBalance = yearlyIncome - yearlyExpenses

  // ── Monthly breakdown for the current year (12 months) ──
  const currentYear = now.getFullYear()
  const monthlyBreakdown = Array.from({ length: 12 }, (_, m) => {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(currentYear, m, 1).toLocaleDateString('hu-HU', { month: 'short' })
    const income = allCashflowEntries
      .filter(e => e.type === 'income' && e.date.startsWith(key))
      .reduce((s, e) => s + e.amount, 0)
    const expenses = allCashflowEntries
      .filter(e => e.type === 'expense' && e.date.startsWith(key))
      .reduce((s, e) => s + e.amount, 0)
    return { month: label, monthKey: key, income, expenses, balance: income - expenses }
  })

  // ── Warehouse ──
  const stockSoldThisYearCount = stockSoldThisYear._sum.quantity || 0
  const stockPurchasedThisYearCount = stockPurchasedThisYear._sum.quantity || 0
  const totalStockCount = totalStockCountAgg._sum.stock || 0

  // ── Top customers ──
  const customerMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const inv of topCustomerInvoices) {
    const key = inv.company?.id || inv.billingName || 'ismeretlen'
    const name = inv.company?.name || inv.billingName || 'Ismeretlen'
    if (!customerMap[key]) customerMap[key] = { name, total: 0, count: 0 }
    customerMap[key].total += inv.total
    customerMap[key].count += 1
  }
  const topCustomers = Object.values(customerMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // ── Deal win rate ──
  const dealWinRate = (dealsWon + dealsLost) > 0
    ? Math.round((dealsWon / (dealsWon + dealsLost)) * 100)
    : null

  // ── Average payment time (days) ──
  const paymentTimes = paidInvoicesWithDates
    .filter(inv => inv.paidAt)
    .map(inv => Math.round((new Date(inv.paidAt!).getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)))
    .filter(d => d >= 0 && d <= 365)
  const avgPaymentDays = paymentTimes.length > 0
    ? Math.round(paymentTimes.reduce((s, d) => s + d, 0) / paymentTimes.length)
    : null

  // ── Top selling products this year ──
  const productSalesMap: Record<string, { name: string; sku: string; qty: number }> = {}
  for (const item of topSoldProductItems) {
    if (!item.product) continue
    const id = item.product.id
    if (!productSalesMap[id]) productSalesMap[id] = { name: item.product.name, sku: item.product.sku, qty: 0 }
    productSalesMap[id].qty += item.quantity
  }
  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

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
    totalStockCount,
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
    // New fields
    yearlyIncome,
    yearlyExpenses,
    yearlyBalance,
    monthlyBreakdown,
    stockSoldThisYear: stockSoldThisYearCount,
    stockPurchasedThisYear: stockPurchasedThisYearCount,
    topCustomers,
    dealWinRate,
    dealsWon,
    dealsLost,
    avgPaymentDays,
    topSellingProducts,
  })
}
