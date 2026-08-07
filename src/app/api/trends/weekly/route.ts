import { NextRequest, NextResponse } from 'next/server'
import { computeWeeklyTrend } from '@/lib/weeklyTrend'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const weeks = request.nextUrl.searchParams.get('weeks')
  const data = await computeWeeklyTrend({ weeks: weeks ? Number(weeks) : undefined })
  return NextResponse.json(data)
}
