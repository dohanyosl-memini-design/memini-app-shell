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

  const expense = await prisma.expense.create({
    data: {
      date: new Date(body.date),
      vendor: body.vendor,
      description: body.description,
      amount: Number(body.amount),
      currency: body.currency || 'EUR',
      vatAmount: Number(body.vatAmount || 0),
      category: body.category || null,
      receiptUrl: body.receiptUrl || null,
      reference: body.reference || null,
    },
  })

  return NextResponse.json(expense, { status: 201 })
}
