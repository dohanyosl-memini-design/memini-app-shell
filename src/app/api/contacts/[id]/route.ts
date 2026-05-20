import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      company: true,
      deals: { orderBy: { createdAt: 'desc' } },
      tasks: { where: { status: { not: 'completed' } }, orderBy: { dueDate: 'asc' } },
      activities: { orderBy: { activityDate: 'desc' }, take: 50 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: {
      salutation: body.salutation || null,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      status: body.status,
      notes: body.notes || null,
      companyId: body.companyId || null,
    },
    include: { company: true },
  })

  return NextResponse.json(contact)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.contact.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
