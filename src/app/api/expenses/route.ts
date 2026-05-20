import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // format: "2025-01"

  const where: Record<string, unknown> = {}
  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)
    where.date = { gte: start, lt: end }
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const amount = Number(body.amount) || 0
  const vatAmount = Number(body.vatAmount) || 0
  const rawTotal = Number(body.totalAmount) || 0
  // Always ensure totalAmount is correct: use explicit total if > 0, else amount + vat
  const totalAmount = rawTotal > 0 ? rawTotal : amount + vatAmount || amount

  const expense = await prisma.expense.create({
    data: {
      date: new Date(body.date),
      vendor: body.vendor,
      description: body.description,
      amount,
      vatAmount,
      totalAmount,
      currency: body.currency || 'EUR',
      category: body.category || null,
      receiptUrl: body.receiptUrl || null,
      reference: body.reference || null,
      status: body.status || 'pending',
      notes: body.notes || null,
      eurAmount: body.eurAmount != null ? Number(body.eurAmount) : null,
      eurRate:   body.eurRate   != null ? Number(body.eurRate)   : null,
    },
  })

  return NextResponse.json(expense, { status: 201 })
}
