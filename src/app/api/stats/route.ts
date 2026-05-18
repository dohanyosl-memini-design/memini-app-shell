import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Canonical expense amount: use totalAmount if > 0, else use amount
function expAmt(e: { totalAmount: number; amount: number }) {
  return e.totalAmount > 0 ? e.totalAmount : e.amount
}

export async function GET() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [
    openInvoices,
    overdueInvoicesCount,
    allActiveProducts,
    monthlyTransactionIncome,
    monthlyTransactionExpenses,
    lastMonthTransactionIncome,
    lastMonthTransactionExpenses,
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
    allPaidInvoices,
    allBookkeepingExpenses,
    stockSoldThisYear,
    stockPurchasedThisYear,
    totalStockCountAgg,
    dealsWon,
    dealsLost,
    paidInvoicesWithDates,
    topSoldProductItems,
  ] = await Promise.all([
    // All outstanding invoices (open + sent)
    prisma.invoice.findMany({
      where: { status: { in: ['open', 'sent'] } },
      select: { total: true, dueDate: true, number: true, company: { select: { name: true } } },
    }),
    // Overdue: open OR sent, past due date
    prisma.invoice.count({ where: { status: { in: ['open', 'sent'] }, dueDate: { lt: now } } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, salesPrice: true },
    }),
    // Monthly transaction income/expenses (manual cash entries)
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'income', date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'expense', date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
    // All transactions for chart + yearly calc
    prisma.transaction.findMany({ orderBy: { date: 'asc' }, select: { type: true, amount: true, date: true, category: true } }),
    // Paid invoices by month (legacy field kept for compatibility)
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
    // All paid invoices (all time) — single source of truth for invoice income + top customers
    prisma.invoice.findMany({
      where: { status: 'paid' },
      select: { total: true, paidAt: true, currency: true, number: true, billingName: true, company: { select: { id: true, name: true } } },
      orderBy: { paidAt: 'asc' },
    }),
    // All bookkeeping expenses — single source of truth for expense amounts
    prisma.expense.findMany({
      orderBy: { date: 'asc' },
      select: { date: true, totalAmount: true, amount: true, category: true, currency: true },
    }),
    prisma.stockMovement.aggregate({ where: { type: 'out', createdAt: { gte: startOfYear } }, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: { type: 'in', createdAt: { gte: startOfYear } }, _sum: { quantity: true } }),
    prisma.product.aggregate({ where: { active: true }, _sum: { stock: true } }),
    prisma.deal.count({ where: { stage: 'closed_won' } }),
    prisma.deal.count({ where: { stage: 'closed_lost' } }),
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { date: true, paidAt: true },
    }),
    prisma.invoiceItem.findMany({
      where: { productId: { not: null }, invoice: { date: { gte: startOfYear } } },
      select: { quantity: true, product: { select: { id: true, name: true, sku: true } } },
    }),
  ])

  // ── Expense sums — all computed from findMany with correct per-entry logic ──

  const expenseSumThisMonth = allBookkeepingExpenses
    .filter(e => new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + expAmt(e), 0)

  const expenseSumLastMonth = allBookkeepingExpenses
    .filter(e => new Date(e.date) >= startOfLastMonth && new Date(e.date) <= endOfLastMonth)
    .reduce((s, e) => s + expAmt(e), 0)

  const yearlyExpenseSum = allBookkeepingExpenses
    .filter(e => new Date(e.date) >= startOfYear)
    .reduce((s, e) => s + expAmt(e), 0)

  // ── Invoice income sums ──

  const invoiceIncomeThisMonth = allPaidInvoices
    .filter(i => i.paidAt && new Date(i.paidAt) >= startOfMonth)
    .reduce((s, i) => s + i.total, 0)

  const invoiceIncomeLastMonth = allPaidInvoices
    .filter(i => i.paidAt && new Date(i.paidAt) >= startOfLastMonth && new Date(i.paidAt) <= endOfLastMonth)
    .reduce((s, i) => s + i.total, 0)

  const yearlyInvoiceIncome = allPaidInvoices
    .filter(i => i.paidAt && new Date(i.paidAt) >= startOfYear)
    .reduce((s, i) => s + i.total, 0)

  // ── Combined monthly totals (Transaction + Invoice + Expense) ──

  const combinedMonthlyIncome = (monthlyTransactionIncome._sum.amount || 0) + invoiceIncomeThisMonth
  const combinedMonthlyExpenses = (monthlyTransactionExpenses._sum.amount || 0) + expenseSumThisMonth
  const combinedLastMonthIncome = (lastMonthTransactionIncome._sum.amount || 0) + invoiceIncomeLastMonth
  const combinedLastMonthExpenses = (lastMonthTransactionExpenses._sum.amount || 0) + expenseSumLastMonth

  // ── Yearly totals ──

  const yearlyTransactionIncome = allTransactions
    .filter(t => t.type === 'income' && new Date(t.date) >= startOfYear)
    .reduce((s, t) => s + t.amount, 0)

  const yearlyTransactionExpenses = allTransactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= startOfYear)
    .reduce((s, t) => s + t.amount, 0)

  const yearlyIncome = yearlyTransactionIncome + yearlyInvoiceIncome
  const yearlyExpenses = yearlyTransactionExpenses + yearlyExpenseSum
  const yearlyBalance = yearlyIncome - yearlyExpenses

  // ── Open invoices ──
  const openInvoicesTotal = openInvoices.reduce((s, i) => s + i.total, 0)

  // ── Product stats ──
  const lowStockProducts = allActiveProducts.filter(p => p.stock <= p.minStock)
  const topProductsByValue = [...allActiveProducts].sort((a, b) => (b.stock * b.salesPrice) - (a.stock * a.salesPrice)).slice(0, 6)
  const totalStockCostValue = allActiveProducts.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalStockSalesValue = allActiveProducts.reduce((s, p) => s + p.stock * p.salesPrice, 0)
  const topProducts = [...allActiveProducts].sort((a, b) => b.stock - a.stock).slice(0, 6)

  // ── Combined cashflow entries for charts — single source of truth ──
  type CfEntry = { type: 'income' | 'expense'; amount: number; date: string; category: string | null }
  const allCashflowEntries: CfEntry[] = [
    ...allTransactions.map(t => ({
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
      category: t.category,
    })),
    ...allPaidInvoices
      .filter(inv => inv.paidAt != null)
      .map(inv => ({
        type: 'income' as const,
        amount: inv.total,
        date: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : String(inv.paidAt),
        category: 'Értékesítés',
      })),
    ...allBookkeepingExpenses.map(exp => ({
      type: 'expense' as const,
      amount: expAmt(exp),
      date: exp.date instanceof Date ? exp.date.toISOString() : String(exp.date),
      category: exp.category,
    })),
  ]

  // ── Monthly breakdown for current year (uses same allCashflowEntries) ──
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

  // ── Top customers (from allPaidInvoices) ──
  const customerMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const inv of allPaidInvoices) {
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
    // Invoice totals
    openInvoicesTotal,
    openInvoicesCount: openInvoices.length,
    overdueInvoices: overdueInvoicesCount,
    openInvoicesList: openInvoices.slice(0, 5),
    // Product/warehouse
    lowStockProducts,
    topProductsByValue,
    topProducts,
    totalStockCostValue,
    totalStockSalesValue,
    totalStockCount,
    // Monthly KPIs (Transaction only — legacy fields kept for compatibility)
    monthlyIncome: monthlyTransactionIncome._sum.amount || 0,
    monthlyExpenses: monthlyTransactionExpenses._sum.amount || 0,
    lastMonthIncome: lastMonthTransactionIncome._sum.amount || 0,
    lastMonthExpenses: lastMonthTransactionExpenses._sum.amount || 0,
    // Monthly KPIs (combined: Transaction + Invoice + Expense)
    combinedMonthlyIncome,
    combinedMonthlyExpenses,
    combinedLastMonthIncome,
    combinedLastMonthExpenses,
    // Yearly KPIs
    yearlyIncome,
    yearlyExpenses,
    yearlyBalance,
    // Chart data (all three sources combined)
    allCashflowEntries,
    allTransactions,
    paidInvoicesByMonth,
    // Monthly breakdown table
    monthlyBreakdown,
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
    // Warehouse
    stockSoldThisYear: stockSoldThisYearCount,
    stockPurchasedThisYear: stockPurchasedThisYearCount,
    // Analytics
    topCustomers,
    dealWinRate,
    dealsWon,
    dealsLost,
    avgPaymentDays,
    topSellingProducts,
    // Legacy: kept for backward compat
    totalRevenue: allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
  })
}
