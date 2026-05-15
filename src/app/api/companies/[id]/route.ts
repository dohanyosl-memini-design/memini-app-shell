import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: { firstName: 'asc' } },
      deals: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { activityDate: 'desc' }, take: 50 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      tasks: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] },
    },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const company = await prisma.company.update({
    where: { id: params.id },
    data: {
      name: body.name,
      partnerType: body.partnerType || null,
      industry: body.industry || null,
      website: body.website || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      zip: body.zip || null,
      city: body.city || null,
      region: body.region || null,
      country: body.country || 'DE',
      vatId: body.vatId || null,
      customerNumber: body.customerNumber || null,
      classification: body.classification || 'D',
      language: body.language || 'DE',
      channel: body.channel || null,
      notes: body.notes || null,
    },
    include: { _count: { select: { contacts: true, deals: true } } },
  })

  return NextResponse.json(company)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.company.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
