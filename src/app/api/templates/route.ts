import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const typeId = searchParams.get('typeId')

  const templates = await prisma.commTemplate.findMany({
    where: { ...(typeId ? { typeId } : {}), isActive: true },
    include: { type: true },
    orderBy: [{ typeId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, typeId, subject, bodyHu, description, isActive, order } = body
  const template = await prisma.commTemplate.create({
    data: {
      name,
      typeId,
      subject: subject ?? null,
      bodyHu,
      description: description ?? null,
      isActive: isActive ?? true,
      order: order ?? 0,
    },
    include: { type: true },
  })
  return NextResponse.json(template, { status: 201 })
}
