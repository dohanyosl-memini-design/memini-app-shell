import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteContentImage, setPrimaryImage } from '@/lib/imageProcessing'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  if (body.makePrimary === true) {
    await setPrimaryImage(params.id)
    return NextResponse.json({ success: true })
  }

  const upd: Record<string, unknown> = {}
  if (body.altDe !== undefined) upd.altDe = body.altDe || null
  if (body.altHu !== undefined) upd.altHu = body.altHu || null
  if (body.altEn !== undefined) upd.altEn = body.altEn || null
  if (body.sortOrder !== undefined) upd.sortOrder = body.sortOrder

  const image = await prisma.contentImage.update({ where: { id: params.id }, data: upd })
  return NextResponse.json(image)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await deleteContentImage(params.id)
  return NextResponse.json({ success: true })
}
