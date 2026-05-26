import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  const contactId = searchParams.get('contactId')

  const where: Record<string, string> = {}
  if (companyId) where.companyId = companyId
  if (contactId) where.contactId = contactId

  const entries = await prisma.memoryEntry.findMany({
    where,
    include: { type: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { companyId, contactId, typeId, content, date, source } = body
  const entry = await prisma.memoryEntry.create({
    data: {
      companyId: companyId ?? null,
      contactId: contactId ?? null,
      typeId,
      content,
      date: date ? new Date(date) : null,
      source: source ?? 'user',
    },
    include: { type: true },
  })
  return NextResponse.json(entry, { status: 201 })
}
