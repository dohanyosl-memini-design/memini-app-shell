import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const arcId = searchParams.get('arcId')
  const status = searchParams.get('status')

  const where: Record<string, unknown> = { archivedAt: null }
  if (arcId) where.arcId = arcId
  if (status) where.status = status

  const themes = await prisma.contentTheme.findMany({
    where,
    include: {
      arc: { select: { id: true, title: true, level: true, year: true, quarter: true, month: true } },
      _count: { select: { pieces: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(themes)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.title) return NextResponse.json({ error: 'A cím kötelező.' }, { status: 400 })

  const theme = await prisma.contentTheme.create({
    data: {
      title: body.title,
      message: body.message || null,
      outline: body.outline || null,
      status: body.status || 'planned',
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      cadence: body.cadence ?? undefined,
      arcId: body.arcId || null,
      sortOrder: body.sortOrder ?? 0,
    },
  })
  return NextResponse.json(theme, { status: 201 })
}
