import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARC_LEVELS } from '@/lib/marketingConstants'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const parentId = searchParams.get('parentId')

  const where: Record<string, unknown> = { archivedAt: null }
  if (level) where.level = level
  if (parentId) where.parentId = parentId

  const arcs = await prisma.marketingArc.findMany({
    where,
    include: { _count: { select: { themes: true, pieces: true, children: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(arcs)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!ARC_LEVELS.includes(body.level)) {
    return NextResponse.json({ error: `Érvénytelen szint: ${body.level}` }, { status: 400 })
  }
  if (body.level !== 'vision' && !body.year) {
    return NextResponse.json({ error: 'Az év megadása kötelező ezen a szinten.' }, { status: 400 })
  }
  if (body.level === 'quarterly' && !(body.quarter >= 1 && body.quarter <= 4)) {
    return NextResponse.json({ error: 'Negyedéves ívhez negyedév (1-4) szükséges.' }, { status: 400 })
  }
  if (body.level === 'monthly' && !(body.month >= 1 && body.month <= 12)) {
    return NextResponse.json({ error: 'Havi ívhez hónap (1-12) szükséges.' }, { status: 400 })
  }

  const arc = await prisma.marketingArc.create({
    data: {
      title: body.title,
      description: body.description || null,
      level: body.level,
      year: body.level === 'vision' ? null : body.year,
      quarter: body.level === 'quarterly' ? body.quarter : null,
      month: body.level === 'monthly' ? body.month : null,
      status: body.status || 'active',
      strategicArea: body.strategicArea || null,
      cadence: body.cadence ?? undefined,
      goalId: body.goalId || null,
      sortOrder: body.sortOrder ?? 0,
      parentId: body.parentId || null,
    },
  })
  return NextResponse.json(arc, { status: 201 })
}
