import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GOAL_LEVELS } from '@/lib/goalConstants'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const status = searchParams.get('status')
  const parentId = searchParams.get('parentId')

  const where: Record<string, unknown> = { archivedAt: null }
  if (level) where.level = level
  if (status) where.status = status
  if (parentId) where.parentId = parentId

  const goals = await prisma.goal.findMany({
    where,
    include: { _count: { select: { tasks: true, children: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(goals)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!GOAL_LEVELS.includes(body.level)) {
    return NextResponse.json({ error: `Érvénytelen szint: ${body.level}` }, { status: 400 })
  }
  if (body.level !== 'vision' && !body.year) {
    return NextResponse.json({ error: 'Az év megadása kötelező ezen a szinten.' }, { status: 400 })
  }
  if (body.level === 'quarterly' && !(body.quarter >= 1 && body.quarter <= 4)) {
    return NextResponse.json({ error: 'Negyedéves célhoz negyedév (1-4) szükséges.' }, { status: 400 })
  }
  if (body.level === 'monthly' && !(body.month >= 1 && body.month <= 12)) {
    return NextResponse.json({ error: 'Havi célhoz hónap (1-12) szükséges.' }, { status: 400 })
  }

  const goal = await prisma.goal.create({
    data: {
      title: body.title,
      description: body.description || null,
      level: body.level,
      year: body.level === 'vision' ? null : body.year,
      quarter: body.level === 'quarterly' ? body.quarter : null,
      month: body.level === 'monthly' ? body.month : null,
      status: body.status || 'active',
      strategicArea: body.strategicArea || null,
      metricKey: body.metricKey || null,
      targetValue: body.targetValue ?? null,
      sortOrder: body.sortOrder ?? 0,
      parentId: body.parentId || null,
    },
  })
  return NextResponse.json(goal, { status: 201 })
}
