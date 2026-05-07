import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const companyId = searchParams.get('companyId')
  const dealId = searchParams.get('dealId')

  const activities = await prisma.activity.findMany({
    where: {
      ...(contactId ? { contactId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: { activityDate: 'desc' },
  })

  return NextResponse.json(activities)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const activity = await prisma.activity.create({
    data: {
      type: body.type,
      subject: body.subject || null,
      description: body.description,
      activityDate: body.activityDate ? new Date(body.activityDate) : new Date(),
      duration: body.duration ? parseInt(body.duration) : null,
      outcome: body.outcome || null,
      contactId: body.contactId || null,
      companyId: body.companyId || null,
      dealId: body.dealId || null,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(activity, { status: 201 })
}
