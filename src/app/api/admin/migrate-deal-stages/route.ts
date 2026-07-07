import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LEGACY_STAGE_MAP } from '@/lib/dealStages'

export const dynamic = 'force-dynamic'

// Egyszeri adatmigráció: régi generikus deal-szakaszok → új B2B tölcsér-szakaszok.
// GET               → dry-run: megmutatja, hány dealt érintene
// GET ?apply=true   → ténylegesen átírja a szakaszokat
export async function GET(req: NextRequest) {
  const apply = req.nextUrl.searchParams.get('apply') === 'true'

  const results: Record<string, number> = {}
  let total = 0

  for (const [oldStage, newStage] of Object.entries(LEGACY_STAGE_MAP)) {
    if (apply) {
      const r = await prisma.deal.updateMany({
        where: { stage: oldStage },
        data: { stage: newStage },
      })
      results[`${oldStage} → ${newStage}`] = r.count
      total += r.count
    } else {
      const count = await prisma.deal.count({ where: { stage: oldStage } })
      results[`${oldStage} → ${newStage}`] = count
      total += count
    }
  }

  // Ellenőrzés: maradt-e ismeretlen (se új, se régi) szakasz-érték
  const distribution = await prisma.deal.groupBy({ by: ['stage'], _count: true })

  return NextResponse.json({
    mode: apply ? 'APPLIED' : 'DRY-RUN (futtasd ?apply=true paraméterrel az éles migrációhoz)',
    migrated: results,
    totalAffected: total,
    currentDistribution: distribution.map((d) => ({ stage: d.stage, count: d._count })),
  })
}
