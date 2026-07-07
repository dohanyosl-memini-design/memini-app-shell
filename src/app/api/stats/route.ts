import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function expAmt(e: { totalAmount: number; amount: number }) {
  return e.totalAmount > 0 ? e.totalAmount : e.amount
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [
    allInvoices,
    allExpenses,
    allTransactionExpenses,
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
    allActiveProducts,
    stockSoldThisYear,
    stockPurchasedThisYear,
    totalStockCountAgg,
    dealsWon,
    dealsLost,
    paidInvoicesWithDates,
    topSoldProductItems,
  ] = await Promise.all([
    // ALL invoices — primary income source
    prisma.invoice.findMany({
      orderBy: { date: 'asc' },
      select: {
        id: true, number: true, date: true, status: true, paidAt: true,
        total: true, subtotal: true, currency: true, dueDate: true,
        billingName: true, company: { select: { id: true, name: true } },
      },
    }),
    // ALL expenses — primary expense source
    prisma.expense.findMany({
      orderBy: { date: 'asc' },
      select: { id: true, date: true, totalAmount: true, amount: true, category: true, currency: true },
    }),
    // Transaction expenses ONLY (for manual expense entries not covered by Expense table)
    prisma.transaction.findMany({
      where: { type: 'expense' },
      orderBy: { date: 'asc' },
      select: { id: true, type: true, amount: true, date: true, category: true, description: true },
    }),
    prisma.company.findMany({
      where: { updatedAt: { lt: days90Ago } },
      select: { id: true, name: true, classification: true, city: true, partnerType: true },
      orderBy: { name: 'asc' }, take: 8,
    }),
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.count({ where: { stage: { notIn: ['won', 'lost'] } } }),
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
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, salesPrice: true },
    }),
    prisma.stockMovement.aggregate({ where: { type: 'out', createdAt: { gte: startOfYear, lte: endOfYear } }, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: { type: 'in', createdAt: { gte: startOfYear, lte: endOfYear } }, _sum: { quantity: true } }),
    prisma.product.aggregate({ where: { active: true }, _sum: { stock: true } }),
    prisma.deal.count({ where: { stage: 'won' } }),
    prisma.deal.count({ where: { stage: 'lost' } }),
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { date: true, paidAt: true },
    }),
    prisma.invoiceItem.findMany({
      where: { productId: { not: null }, invoice: { date: { gte: startOfYear, lte: endOfYear } } },
      select: { quantity: true, product: { select: { id: true, name: true, sku: true } } },
    }),
  ])

  // ─── INCOME: ALL invoices by their issue date ───────────────────────────────
  // "Számlázott" = billed (all statuses)
  // "Beérkezett" = received (paid only, by paidAt)

  const invoiceDateIn = (inv: { date: Date | string }, from: Date, to?: Date) => {
    const d = new Date(inv.date)
    return d >= from && (!to || d <= to)
  }

  const billedThisMonth = allInvoices
    .filter(i => invoiceDateIn(i, startOfMonth))
    .reduce((s, i) => s + i.total, 0)

  const billedLastMonth = allInvoices
    .filter(i => invoiceDateIn(i, startOfLastMonth, endOfLastMonth))
    .reduce((s, i) => s + i.total, 0)

  const billedThisYear = allInvoices
    .filter(i => invoiceDateIn(i, startOfYear, endOfYear))
    .reduce((s, i) => s + i.total, 0)

  const billedNetThisYear = allInvoices
    .filter(i => invoiceDateIn(i, startOfYear, endOfYear))
    .reduce((s, i) => s + (i.subtotal ?? i.total), 0)

  const invoiceCountThisYear = allInvoices
    .filter(i => invoiceDateIn(i, startOfYear, endOfYear)).length

  const receivedThisYear = allInvoices
    .filter(i => i.status === 'paid' && i.paidAt && new Date(i.paidAt) >= startOfYear && new Date(i.paidAt) <= endOfYear)
    .reduce((s, i) => s + i.total, 0)

  const openInvoices = allInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'storno')
  const openInvoicesTotal = openInvoices.reduce((s, i) => s + i.total, 0)
  const overdueInvoices = openInvoices.filter(i => new Date(i.dueDate) < now).length

  // ─── EXPENSES: Expense table + Transaction expenses ──────────────────────────

  const expThisMonth = allExpenses
    .filter(e => new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + expAmt(e), 0)

  const expLastMonth = allExpenses
    .filter(e => new Date(e.date) >= startOfLastMonth && new Date(e.date) <= endOfLastMonth)
    .reduce((s, e) => s + expAmt(e), 0)

  const expThisYear = allExpenses
    .filter(e => new Date(e.date) >= startOfYear && new Date(e.date) <= endOfYear)
    .reduce((s, e) => s + expAmt(e), 0)

  const txExpThisMonth = allTransactionExpenses
    .filter(t => new Date(t.date) >= startOfMonth)
    .reduce((s, t) => s + t.amount, 0)

  const txExpLastMonth = allTransactionExpenses
    .filter(t => new Date(t.date) >= startOfLastMonth && new Date(t.date) <= endOfLastMonth)
    .reduce((s, t) => s + t.amount, 0)

  const txExpThisYear = allTransactionExpenses
    .filter(t => new Date(t.date) >= startOfYear && new Date(t.date) <= endOfYear)
    .reduce((s, t) => s + t.amount, 0)

  const combinedMonthlyIncome = billedThisMonth
  const combinedMonthlyExpenses = expThisMonth + txExpThisMonth
  const combinedLastMonthIncome = billedLastMonth
  const combinedLastMonthExpenses = expLastMonth + txExpLastMonth

  const yearlyIncome = billedThisYear
  const yearlyExpenses = expThisYear + txExpThisYear
  const yearlyBalance = yearlyIncome - yearlyExpenses

  const COGS_CATEGORIES = ['Termékköltség', 'Alapanyag', 'Gyártás']
  const yearlyCogs = allExpenses
    .filter(e => new Date(e.date) >= startOfYear && new Date(e.date) <= endOfYear && COGS_CATEGORIES.includes(e.category ?? ''))
    .reduce((s, e) => s + expAmt(e), 0)
  const yearlyOtherExpenses = yearlyExpenses - yearlyCogs

  // ─── CASHFLOW ENTRIES for chart (invoices + expenses + tx expenses) ──────────
  type CfEntry = { type: 'income' | 'expense'; amount: number; date: string; category: string | null }
  const allCashflowEntries: CfEntry[] = [
    ...allInvoices
      .filter(inv => new Date(inv.date) >= startOfYear && new Date(inv.date) <= endOfYear)
      .map(inv => ({
        type: 'income' as const,
        amount: inv.total,
        date: inv.date instanceof Date ? inv.date.toISOString() : String(inv.date),
        category: 'Értékesítés',
      })),
    ...allExpenses
      .filter(exp => new Date(exp.date) >= startOfYear && new Date(exp.date) <= endOfYear)
      .map(exp => ({
        type: 'expense' as const,
        amount: expAmt(exp),
        date: exp.date instanceof Date ? exp.date.toISOString() : String(exp.date),
        category: exp.category,
      })),
    ...allTransactionExpenses
      .filter(t => new Date(t.date) >= startOfYear && new Date(t.date) <= endOfYear)
      .map(t => ({
        type: 'expense' as const,
        amount: t.amount,
        date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
        category: t.category,
      })),
  ]

  // ─── MONTHLY BREAKDOWN for selected year ─────────────────────────────────────
  const yearInvoices = allInvoices.filter(i => invoiceDateIn(i, startOfYear, endOfYear))
  const monthlyBreakdown = Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(year, m, 1).toLocaleDateString('hu-HU', { month: 'short' })
    const monthInvoices = yearInvoices.filter(i => {
      const d = i.date instanceof Date ? i.date.toISOString() : String(i.date)
      return d.startsWith(key)
    })
    const grossIncome = monthInvoices.reduce((s, i) => s + i.total, 0)
    const netIncome = monthInvoices.reduce((s, i) => s + (i.subtotal ?? i.total), 0)
    const expenses = allCashflowEntries
      .filter(e => e.type === 'expense' && e.date.startsWith(key))
      .reduce((s, e) => s + e.amount, 0)
    return { month: label, monthKey: key, income: grossIncome, grossIncome, netIncome, expenses, balance: netIncome - expenses }
  })

  // ─── TOP CUSTOMERS ────────────────────────────────────────────────────────────
  const customerMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const inv of allInvoices) {
    const key = inv.company?.id || inv.billingName || 'ismeretlen'
    const name = inv.company?.name || inv.billingName || 'Ismeretlen'
    if (!customerMap[key]) customerMap[key] = { name, total: 0, count: 0 }
    customerMap[key].total += inv.total
    customerMap[key].count += 1
  }
  const topCustomers = Object.values(customerMap).sort((a, b) => b.total - a.total).slice(0, 5)

  // ─── PRODUCT STATS ───────────────────────────────────────────────────────────
  const lowStockProducts = allActiveProducts.filter(p => p.stock <= p.minStock)
  const topProductsByValue = [...allActiveProducts].sort((a, b) => (b.stock * b.salesPrice) - (a.stock * a.salesPrice)).slice(0, 6)
  const totalStockCostValue = allActiveProducts.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalStockSalesValue = allActiveProducts.reduce((s, p) => s + p.stock * p.salesPrice, 0)
  const topProducts = [...allActiveProducts].sort((a, b) => b.stock - a.stock).slice(0, 6)

  // ─── WAREHOUSE ───────────────────────────────────────────────────────────────
  const stockSoldThisYearCount = stockSoldThisYear._sum.quantity || 0
  const stockPurchasedThisYearCount = stockPurchasedThisYear._sum.quantity || 0
  const totalStockCount = totalStockCountAgg._sum.stock || 0

  // ─── DEAL STATS ──────────────────────────────────────────────────────────────
  const dealWinRate = (dealsWon + dealsLost) > 0
    ? Math.round((dealsWon / (dealsWon + dealsLost)) * 100)
    : null

  const paymentTimes = paidInvoicesWithDates
    .filter(inv => inv.paidAt)
    .map(inv => Math.round((new Date(inv.paidAt!).getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)))
    .filter(d => d >= 0 && d <= 365)
  const avgPaymentDays = paymentTimes.length > 0
    ? Math.round(paymentTimes.reduce((s, d) => s + d, 0) / paymentTimes.length)
    : null

  // ─── TOP SELLING PRODUCTS ────────────────────────────────────────────────────
  const productSalesMap: Record<string, { name: string; sku: string; qty: number }> = {}
  for (const item of topSoldProductItems) {
    if (!item.product) continue
    const id = item.product.id
    if (!productSalesMap[id]) productSalesMap[id] = { name: item.product.name, sku: item.product.sku, qty: 0 }
    productSalesMap[id].qty += item.quantity
  }
  const topSellingProducts = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 8)

  return NextResponse.json({
    // Invoice totals
    openInvoicesTotal,
    openInvoicesCount: openInvoices.length,
    overdueInvoices,
    openInvoicesList: openInvoices.slice(0, 5),
    // Monthly KPIs
    combinedMonthlyIncome,
    combinedMonthlyExpenses,
    combinedLastMonthIncome,
    combinedLastMonthExpenses,
    monthlyIncome: combinedMonthlyIncome,
    monthlyExpenses: combinedMonthlyExpenses,
    lastMonthIncome: combinedLastMonthIncome,
    lastMonthExpenses: combinedLastMonthExpenses,
    // Yearly KPIs
    yearlyIncome,
    yearlyNetIncome: billedNetThisYear,
    yearlyExpenses,
    yearlyCogs,
    yearlyOtherExpenses,
    yearlyBalance,
    yearlyNetBalance: billedNetThisYear - (expThisYear + txExpThisYear),
    receivedThisYear,
    invoiceCountThisYear,
    // Chart data
    allCashflowEntries,
    allTransactions: allTransactionExpenses,
    paidInvoicesByMonth: allInvoices.filter(i => i.status === 'paid' && i.paidAt),
    // Monthly breakdown
    monthlyBreakdown,
    // Product/warehouse
    lowStockProducts,
    topProductsByValue,
    topProducts,
    totalStockCostValue,
    totalStockSalesValue,
    totalStockCount,
    stockSoldThisYear: stockSoldThisYearCount,
    stockPurchasedThisYear: stockPurchasedThisYearCount,
    // CRM
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
    // Analytics
    topCustomers,
    dealWinRate,
    dealsWon,
    dealsLost,
    avgPaymentDays,
    topSellingProducts,
    totalRevenue: billedThisYear,
    selectedYear: year,
  })
}
