import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface CashflowEntry {
  id: string
  source: 'transaction' | 'invoice' | 'expense'
  type: 'income' | 'expense'
  status: string | null
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

export async function GET() {
  const now = new Date()
  const [allInvoices, allExpenses, transactionExpenses] = await Promise.all([
    prisma.invoice.findMany({
      select: {
        id: true, number: true, total: true, date: true, dueDate: true,
        paidAt: true, status: true, currency: true,
        company: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.findMany({
      orderBy: { date: 'desc' },
    }),
    // Only expense transactions — income transactions are covered by Invoice records
    prisma.transaction.findMany({
      where: { type: 'expense' },
      orderBy: { date: 'desc' },
    }),
  ])

  const entries: CashflowEntry[] = [
    // ALL invoices as income (all statuses)
    ...allInvoices.map(inv => {
      const isOverdue = inv.status !== 'paid' && new Date(inv.dueDate) < now
      const resolvedStatus = inv.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : inv.status
      return {
        id: inv.id,
        source: 'invoice' as const,
        type: 'income' as const,
        status: resolvedStatus,
        amount: inv.total,
        currency: inv.currency,
        date: (inv.paidAt ?? inv.date).toISOString(),
        description: inv.company?.name ? `Számla – ${inv.company.name}` : `Számla ${inv.number}`,
        category: 'Értékesítés',
        reference: inv.number,
      }
    }),
    // Expenses from Expense table
    ...allExpenses.map(exp => ({
      id: exp.id,
      source: 'expense' as const,
      type: 'expense' as const,
      status: null,
      amount: exp.totalAmount > 0 ? exp.totalAmount : exp.amount,
      currency: exp.currency,
      date: exp.date.toISOString(),
      description: exp.description ? `${exp.vendor} – ${exp.description}` : exp.vendor,
      category: exp.category,
      reference: exp.reference,
    })),
    // Manual expense transactions
    ...transactionExpenses.map(t => ({
      id: t.id,
      source: 'transaction' as const,
      type: 'expense' as const,
      status: null,
      amount: t.amount,
      currency: t.currency,
      date: t.date.toISOString(),
      description: t.description,
      category: t.category,
      reference: t.reference,
    })),
  ]

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json(entries)
}
