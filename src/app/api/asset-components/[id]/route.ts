import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.nameDE !== undefined) data.nameDE = body.nameDE?.trim() || null
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
  if (body.defaultValue !== undefined) data.defaultValue = parseFloat(body.defaultValue) || 0
  if (body.defaultQuantity !== undefined) data.defaultQuantity = parseInt(body.defaultQuantity) > 0 ? parseInt(body.defaultQuantity) : 1
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0
  if (body.active !== undefined) data.active = !!body.active

  const component = await prisma.assetComponent.update({ where: { id: params.id }, data })
  return NextResponse.json(component)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.assetComponent.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
