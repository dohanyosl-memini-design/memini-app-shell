import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Az import-csomagok listája állapotonkénti darabszámokkal (a felhatalmazás megadásához).
export async function GET() {
  const batches = await prisma.importBatch.findMany({ orderBy: { startedAt: 'desc' }, take: 50 })
  const groups = await prisma.financialDocument.groupBy({ by: ['batchId', 'status'], where: { batchId: { in: batches.map((b) => b.id) } }, _count: { _all: true } })
  const counts: Record<string, Record<string, number>> = {}
  for (const g of groups) if (g.batchId) (counts[g.batchId] ??= {})[g.status] = g._count._all
  return NextResponse.json({ batches: batches.map((b) => ({ id: b.id, filename: b.filename, status: b.status, startedAt: b.startedAt, byStatus: counts[b.id] ?? {} })) })
}
