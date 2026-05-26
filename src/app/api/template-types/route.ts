import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const types = await prisma.templateType.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { templates: true } } },
  })
  return NextResponse.json(types)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { label, icon, isSystem, order } = body
  const type = await prisma.templateType.create({
    data: { label, icon, isSystem: isSystem ?? false, order: order ?? 0 },
  })
  return NextResponse.json(type, { status: 201 })
}
