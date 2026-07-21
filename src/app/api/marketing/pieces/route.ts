import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logPieceCreated } from '@/lib/contentEvents'

export const dynamic = 'force-dynamic'

const include = {
  theme: { select: { id: true, title: true } },
  arc: { select: { id: true, title: true, level: true } },
  parentPiece: { select: { id: true, title: true, channel: true } },
  _count: { select: { derivedPieces: true } },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  const status = searchParams.get('status')
  const themeId = searchParams.get('themeId')
  const arcId = searchParams.get('arcId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (channel) where.channel = channel
  if (status) where.status = status
  else where.status = { not: 'archived' }
  if (themeId) where.themeId = themeId
  if (arcId) where.arcId = arcId
  if (from || to) {
    where.scheduledFor = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    }
  }

  const pieces = await prisma.contentPiece.findMany({
    where,
    include,
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(pieces)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.title || !body.channel) {
    return NextResponse.json({ error: 'A cím és a csatorna kötelező.' }, { status: 400 })
  }

  const piece = await prisma.contentPiece.create({
    data: {
      title: body.title,
      channel: body.channel,
      bodyDe: body.bodyDe || null,
      bodyHu: body.bodyHu || null,
      bodyEn: body.bodyEn || null,
      slug: body.slug || null,
      seo: body.seo ?? undefined,
      imagePrompt: body.imagePrompt || null,
      imageUrl: body.imageUrl || null,
      status: body.status || 'draft',
      source: body.source || 'human',
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      themeId: body.themeId || null,
      arcId: body.arcId || null,
      parentPieceId: body.parentPieceId || null,
    },
    include,
  })

  await logPieceCreated(piece.id, body.actor || 'web', body.parentPieceId ? 'derived' : 'created')

  return NextResponse.json(piece, { status: 201 })
}
