import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.nameDE !== undefined) data.nameDE = body.nameDE?.trim() || null
  if (body.category !== undefined) data.category = body.category || null
  if (body.defaultValue !== undefined) data.defaultValue = parseFloat(body.defaultValue) || 0
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
  if (body.contractAddendumDe !== undefined) data.contractAddendumDe = body.contractAddendumDe?.trim() || null
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0
  if (body.active !== undefined) data.active = !!body.active

  const type = await prisma.assetType.update({
    where: { id: params.id },
    data,
    include: { components: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
  })
  return NextResponse.json(type)
}

// Kivezetés = soft-delete (active:false). SOHA nem törlünk, hogy a rá hivatkozó
// korábbi kihelyezések és szerződések épek maradjanak.
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.assetType.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
