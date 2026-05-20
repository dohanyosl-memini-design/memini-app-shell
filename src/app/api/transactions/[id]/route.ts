import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const transaction = await prisma.transaction.update({
    where: { id: params.id },
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

  return NextResponse.json(transaction)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.transaction.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
