import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const partnerType = searchParams.get('partnerType') || ''
  const region = searchParams.get('region') || ''
  const country = searchParams.get('country') || ''
  const classification = searchParams.get('classification') || ''
  const language = searchParams.get('language') || ''

  const companies = await prisma.company.findMany({
    where: {
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { city: { contains: search } },
          { email: { contains: search } },
        ],
      } : {}),
      ...(partnerType ? { partnerType } : {}),
      ...(region ? { region } : {}),
      ...(country ? { country } : {}),
      ...(classification ? { classification } : {}),
      ...(language ? { language } : {}),
    },
    include: {
      _count: { select: { contacts: true, deals: true, orders: true } },
      activities: { orderBy: { activityDate: 'desc' }, take: 1, select: { activityDate: true } },
    },
    orderBy: [{ classification: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(companies)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const company = await prisma.company.create({
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
    include: { _count: { select: { contacts: true, deals: true, orders: true } } },
  })

  return NextResponse.json(company, { status: 201 })
}
