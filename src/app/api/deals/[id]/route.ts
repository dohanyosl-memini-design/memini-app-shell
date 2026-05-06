import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const deal = await prisma.deal.update({
    where: { id: params.id },
    data: {
      title: body.title,
      value: parseFloat(body.value) || 0,
      stage: body.stage,
      probability: parseInt(body.probability) || 0,
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      notes: body.notes || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
    },
    include: { contact: true, company: true },
  })

  return NextResponse.json(deal)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.deal.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
