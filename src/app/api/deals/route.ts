import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const deals = await prisma.deal.findMany({
    include: {
      contact: true,
      company: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(deals)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const deal = await prisma.deal.create({
    data: {
      title: body.title,
      value: parseFloat(body.value) || 0,
      stage: body.stage || 'prospect',
      probability: parseInt(body.probability) || 0,
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      notes: body.notes || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
    },
    include: { contact: true, company: true },
  })

  return NextResponse.json(deal, { status: 201 })
}
