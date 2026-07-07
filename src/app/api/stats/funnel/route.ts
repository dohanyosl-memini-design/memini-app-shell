import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeFunnelStats, type Granularity } from '@/lib/funnelStats'

export const dynamic = 'force-dynamic'

// Tölcsér-KPI dashboard adatforrás (FÁZIS 2).
// GET /api/stats/funnel?granularity=month|week&periods=6
export async function GET(req: NextRequest) {
  const g = req.nextUrl.searchParams.get('granularity')
  const granularity: Granularity = g === 'week' ? 'week' : 'month'
  const periodsRaw = req.nextUrl.searchParams.get('periods')
  const periods = periodsRaw ? parseInt(periodsRaw, 10) : undefined

  const stats = await computeFunnelStats({
    granularity,
    periods: Number.isFinite(periods) ? periods : undefined,
  })

  return NextResponse.json(stats)
}
