import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const types = await prisma.memoryEntryType.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(types)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { label, icon, color, isSystem, order } = body
  const type = await prisma.memoryEntryType.create({
    data: { label, icon, color: color ?? 'gray', isSystem: isSystem ?? false, order: order ?? 0 },
  })
  return NextResponse.json(type, { status: 201 })
}
