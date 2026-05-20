import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

export async function GET() {
  const [
    contacts,
    companies,
    deals,
    tasks,
    activities,
    products,
    invoices,
    quotes,
    orders,
    expenses,
    recurringExpenses,
    transactions,
    priceListEntries,
  ] = await Promise.all([
    prisma.contact.findMany(),
    prisma.company.findMany(),
    prisma.deal.findMany(),
    prisma.task.findMany({ include: { subtasks: true } }),
    prisma.activity.findMany(),
    prisma.product.findMany({ include: { movements: true } }),
    prisma.invoice.findMany({ include: { items: true } }),
    prisma.quote.findMany({ include: { items: true } }),
    prisma.order.findMany({ include: { items: true } }),
    prisma.expense.findMany(),
    prisma.recurringExpense.findMany(),
    prisma.transaction.findMany(),
    prisma.priceListEntry.findMany(),
  ])

  const backup = {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      app: 'Memini CRM',
    },
    counts: {
      contacts: contacts.length,
      companies: companies.length,
      deals: deals.length,
      tasks: tasks.length,
      activities: activities.length,
      products: products.length,
      invoices: invoices.length,
      quotes: quotes.length,
      orders: orders.length,
      expenses: expenses.length,
      recurringExpenses: recurringExpenses.length,
      transactions: transactions.length,
      priceListEntries: priceListEntries.length,
    },
    data: {
      contacts,
      companies,
      deals,
      tasks,
      activities,
      products,
      invoices,
      quotes,
      orders,
      expenses,
      recurringExpenses,
      transactions,
      priceListEntries,
    },
  }

  const json = JSON.stringify(backup, null, 2)
  const filename = `memini-backup-${format(new Date(), 'yyyy-MM-dd')}.json`

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
