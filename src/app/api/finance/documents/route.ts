import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listDocuments } from '@/lib/finance/documents'

export const dynamic = 'force-dynamic'

// Pénzügyi dokumentumok listája az ellenőrzési sorhoz + állapotonkénti darabszámok.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const [list, groups] = await Promise.all([
    listDocuments({
      status: p.get('status') ?? undefined, kind: p.get('kind') ?? undefined,
      direction: p.get('direction') ?? undefined, batchId: p.get('batchId') ?? undefined,
      limit: Number(p.get('limit')) || 100,
    }),
    prisma.financialDocument.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
  const unverified = await prisma.financialDocument.count({ where: { hashVerifiedAt: null, status: { in: ['needs_review', 'recorded'] } } })
  return NextResponse.json({ ...list, counts, unverified })
}
