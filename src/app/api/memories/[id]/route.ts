import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { typeId, content, date, source } = body
  const entry = await prisma.memoryEntry.update({
    where: { id: params.id },
    data: { typeId, content, date: date ? new Date(date) : null, source },
    include: { type: true },
  })
  return NextResponse.json(entry)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.memoryEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
