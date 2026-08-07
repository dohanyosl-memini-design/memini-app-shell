import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_FUNNEL_TARGETS } from '@/lib/funnelTargets'
import { requireAdmin } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// A beépített 2026 H2 tervszámok feltöltése a FunnelTarget táblába (upsert).
// Idempotens: újrafuttatható, a meglévő hónapokat felülírja a defaultokkal.
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const results: { yearMonth: string; status: string }[] = []

  for (const [yearMonth, t] of Object.entries(DEFAULT_FUNNEL_TARGETS)) {
    await prisma.funnelTarget.upsert({
      where: { yearMonth },
      create: { yearMonth, ...t },
      update: { ...t },
    })
    results.push({ yearMonth, status: 'feltöltve' })
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
