import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { label, icon, order } = body
  const type = await prisma.templateType.update({
    where: { id: params.id },
    data: { label, icon, order },
  })
  return NextResponse.json(type)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.templateType.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.isSystem) return NextResponse.json({ error: 'Cannot delete system type' }, { status: 400 })
  await prisma.templateType.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
