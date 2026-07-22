import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logPieceDiff, logPieceEvent } from '@/lib/contentEvents'

export const dynamic = 'force-dynamic'

const include = {
  theme: { select: { id: true, title: true, arcId: true, message: true, outline: true } },
  arc: { select: { id: true, title: true, level: true } },
  parentPiece: { select: { id: true, title: true, channel: true, bodyDe: true } },
  derivedPieces: { select: { id: true, title: true, channel: true, status: true } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
  events: { orderBy: { createdAt: 'desc' as const }, take: 50 },
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const piece = await prisma.contentPiece.findUnique({ where: { id: params.id }, include })
  if (!piece) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(piece)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const before = await prisma.contentPiece.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const upd: Record<string, unknown> = {}
  if (body.title !== undefined) upd.title = body.title
  if (body.channel !== undefined) upd.channel = body.channel
  if (body.bodyDe !== undefined) upd.bodyDe = body.bodyDe || null
  if (body.bodyHu !== undefined) upd.bodyHu = body.bodyHu || null
  if (body.bodyEn !== undefined) upd.bodyEn = body.bodyEn || null
  if (body.slug !== undefined) upd.slug = body.slug || null
  if (body.seo !== undefined) upd.seo = body.seo
  if (body.imagePrompt !== undefined) upd.imagePrompt = body.imagePrompt || null
  if (body.imageUrl !== undefined) upd.imageUrl = body.imageUrl || null
  if (body.status !== undefined) {
    upd.status = body.status
    if (body.status === 'published' && !before.publishedAt) upd.publishedAt = new Date()
  }
  if (body.scheduledFor !== undefined) upd.scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null
  if (body.themeId !== undefined) upd.themeId = body.themeId || null
  if (body.arcId !== undefined) upd.arcId = body.arcId || null
  if (body.parentPieceId !== undefined) upd.parentPieceId = body.parentPieceId || null

  const piece = await prisma.contentPiece.update({ where: { id: params.id }, data: upd, include })

  await logPieceDiff(params.id, body.actor || 'web', before, piece)

  return NextResponse.json(piece)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  // A származtatott gyerekek megmaradnak, csak a szülő-kapcsolat oldódik le.
  await prisma.contentPiece.updateMany({ where: { parentPieceId: params.id }, data: { parentPieceId: null } })
  await prisma.contentPiece.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

// Segéd-művelet: generálás eredményének mentése egy mezőbe (naplózva).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const before = await prisma.contentPiece.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const field = body.field as string
  const allowed = ['bodyDe', 'bodyHu', 'bodyEn']
  if (!allowed.includes(field)) {
    return NextResponse.json({ error: 'Csak body mező tölthető így.' }, { status: 400 })
  }
  const piece = await prisma.contentPiece.update({
    where: { id: params.id },
    data: { [field]: body.value || null },
    include,
  })
  await logPieceEvent(params.id, body.actor || 'web', body.action || 'updated', field)
  return NextResponse.json(piece)
}
