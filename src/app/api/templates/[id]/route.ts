import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const template = await prisma.commTemplate.findUnique({
    where: { id: params.id },
    include: { type: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { name, typeId, subject, bodyHu, description, isActive, order } = body
  const template = await prisma.commTemplate.update({
    where: { id: params.id },
    data: { name, typeId, subject, bodyHu, description, isActive, order },
    include: { type: true },
  })
  return NextResponse.json(template)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.commTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
