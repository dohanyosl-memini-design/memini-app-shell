import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || ''

  const transactions = await prisma.transaction.findMany({
    where: type ? { type } : {},
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const transaction = await prisma.transaction.create({
    data: {
      type: body.type,
      amount: parseFloat(body.amount),
      currency: body.currency || 'EUR',
      date: new Date(body.date),
      description: body.description,
      category: body.category || null,
      reference: body.reference || null,
    },
  })

  return NextResponse.json(transaction, { status: 201 })
}
