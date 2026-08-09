import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PIPELINE_ONLY_STATUSES = ['lead', 'contacted']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const crmOnly = searchParams.get('crmOnly') === 'true'
  // Archiváltak alapból rejtve; ?archived=true kifejezetten kéri őket.
  const archived = searchParams.get('archived') === 'true'

  const contacts = await prisma.contact.findMany({
    where: {
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(crmOnly ? { status: { notIn: PIPELINE_ONLY_STATUSES } } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
        ],
      } : {}),
    },
    include: { company: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const contact = await prisma.contact.create({
    data: {
      salutation: body.salutation || null,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      status: body.status || 'lead',
      notes: body.notes || null,
      companyId: body.companyId || null,
    },
    include: { company: true },
  })

  return NextResponse.json(contact, { status: 201 })
}
