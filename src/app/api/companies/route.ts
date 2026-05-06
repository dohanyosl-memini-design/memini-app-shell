import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''

  const companies = await prisma.company.findMany({
    where: search ? { name: { contains: search } } : {},
    include: { _count: { select: { contacts: true, deals: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(companies)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const company = await prisma.company.create({
    data: {
      name: body.name,
      industry: body.industry || null,
      website: body.website || null,
      phone: body.phone || null,
      address: body.address || null,
    },
    include: { _count: { select: { contacts: true, deals: true } } },
  })

  return NextResponse.json(company, { status: 201 })
}
