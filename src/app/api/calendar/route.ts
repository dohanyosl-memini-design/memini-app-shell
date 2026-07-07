import { NextRequest, NextResponse } from 'next/server'
import { addDays, startOfDay, endOfDay } from 'date-fns'
import { aggregateCalendarEvents } from '@/lib/calendar/aggregate'
import { getRitualsInRange } from '@/lib/calendar/recurring'
import type { CalendarPayload } from '@/lib/calendar/types'

export const dynamic = 'force-dynamic'

// GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD → { from, to, events, rituals }
// A meglévő auth mögött (a middleware minden route-ot véd az api/mcp kivételével).
export async function GET(req: NextRequest) {
  const fromParam = req.nextUrl.searchParams.get('from')
  const toParam = req.nextUrl.searchParams.get('to')

  const from = fromParam ? new Date(fromParam) : startOfDay(new Date())
  const to = toParam ? new Date(toParam) : endOfDay(addDays(from, 13))

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Érvénytelen from/to dátum.' }, { status: 400 })
  }

  const [events, rituals] = await Promise.all([
    aggregateCalendarEvents({ from, to }),
    Promise.resolve(getRitualsInRange(startOfDay(from), endOfDay(to))),
  ])

  const payload: CalendarPayload = {
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
    events,
    rituals,
  }
  return NextResponse.json(payload)
}
