import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const item = await prisma.recurringExpense.update({
    where: { id: params.id },
    data: {
      name: body.name,
      vendor: body.vendor || null,
      amount: Number(body.amount),
      currency: body.currency || 'EUR',
      category: body.category || null,
      frequency: body.frequency || 'monthly',
      startDate: new Date(body.startDate),
      nextDue: new Date(body.nextDue),
      active: body.active !== false,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.recurringExpense.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
