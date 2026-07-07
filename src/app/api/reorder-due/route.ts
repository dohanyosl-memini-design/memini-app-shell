import { NextRequest, NextResponse } from 'next/server'
import { computeReorderDue } from '@/lib/reorderDue'

export const dynamic = 'force-dynamic'

// Esedékes reorder lista (FÁZIS 3) adatforrás.
// GET /api/reorder-due?thresholdMonths=9
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('thresholdMonths')
  const thresholdMonths = raw ? parseInt(raw, 10) : undefined

  const data = await computeReorderDue({
    thresholdMonths: Number.isFinite(thresholdMonths) ? thresholdMonths : undefined,
  })

  return NextResponse.json(data)
}
