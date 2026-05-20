import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const amount = Number(body.amount) || 0
  const vatAmount = Number(body.vatAmount) || 0
  const rawTotal = Number(body.totalAmount) || 0
  const totalAmount = rawTotal > 0 ? rawTotal : amount + vatAmount || amount

  const expense = await prisma.expense.update({
    where: { id: params.id },
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

  return NextResponse.json(expense)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.expense.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
