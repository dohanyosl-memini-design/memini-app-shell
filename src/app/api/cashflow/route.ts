import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface CashflowEntry {
  id: string
  source: 'transaction' | 'invoice' | 'expense'
  type: 'income' | 'expense'
  amount: number
  currency: string
  date: string
  description: string
  category: string | null
  reference: string | null
}

export async function GET() {
  const [transactions, paidInvoices, expenses] = await Promise.all([
    prisma.transaction.findMany({ orderBy: { date: 'desc' } }),
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      select: { id: true, number: true, total: true, paidAt: true, currency: true, company: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
  ])

  const entries: CashflowEntry[] = [
    ...transactions.map(t => ({
      id: t.id,
      source: 'transaction' as const,
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      currency: t.currency,
      date: t.date.toISOString(),
      description: t.description,
      category: t.category,
      reference: t.reference,
    })),
    ...paidInvoices.map(inv => ({
      id: inv.id,
      source: 'invoice' as const,
      type: 'income' as const,
      amount: inv.total,
      currency: inv.currency,
      date: inv.paidAt!.toISOString(),
      description: inv.company?.name ? `Számla – ${inv.company.name}` : `Számla ${inv.number}`,
      category: 'Értékesítés',
      reference: inv.number,
    })),
    ...expenses.map(exp => ({
      id: exp.id,
      source: 'expense' as const,
      type: 'expense' as const,
      amount: exp.totalAmount > 0 ? exp.totalAmount : exp.amount,
      currency: exp.currency,
      date: exp.date.toISOString(),
      description: exp.description ? `${exp.vendor} – ${exp.description}` : exp.vendor,
      category: exp.category,
      reference: exp.reference,
    })),
  ]

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json(entries)
}
