import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const expense = await prisma.expense.update({
    where: { id: params.id },
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

  return NextResponse.json(expense)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.expense.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
