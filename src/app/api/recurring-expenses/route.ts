import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await prisma.recurringExpense.findMany({
    orderBy: { nextDue: 'asc' },
  })
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const item = await prisma.recurringExpense.create({
    data: {
      name: body.name,
      vendor: body.vendor || null,
      amount: Number(body.amount),
      currency: body.currency || 'EUR',
      category: body.category || null,
      frequency: body.frequency || 'monthly',
      startDate: new Date(body.startDate),
      nextDue: new Date(body.nextDue || body.startDate),
      active: body.active !== false,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
