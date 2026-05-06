import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const company = await prisma.company.update({
    where: { id: params.id },
    data: {
      name: body.name,
      industry: body.industry || null,
      website: body.website || null,
      phone: body.phone || null,
      address: body.address || null,
    },
    include: { _count: { select: { contacts: true, deals: true } } },
  })

  return NextResponse.json(company)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.company.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
