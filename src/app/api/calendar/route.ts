import { NextRequest, NextResponse } from 'next/server'
import { addDays, startOfDay, endOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
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

// POST /api/calendar — feladat vagy időpont felvétele a naptárból.
// A meglévő modellekbe ír (nincs új tábla): kind='task' → Task, kind='appointment' → Activity.
interface CreateBody {
  kind: 'task' | 'appointment'
  title: string
  date: string           // YYYY-MM-DD
  time?: string          // HH:mm (task: opcionális → egész napos; appointment: kötelező)
  durationMin?: number   // appointment hossz percben
  priority?: 'low' | 'medium' | 'high'
  notes?: string
  companyId?: string
  contactId?: string
  dealId?: string
}

function buildDate(date: string, time?: string): Date {
  return new Date(`${date}T${time && time.length >= 4 ? time : '00:00'}:00`)
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<CreateBody>

  if (!body.kind || !['task', 'appointment'].includes(body.kind)) {
    return NextResponse.json({ error: 'kind kötelező (task vagy appointment).' }, { status: 400 })
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'A cím kötelező.' }, { status: 400 })
  }
  if (!body.date) {
    return NextResponse.json({ error: 'A dátum kötelező.' }, { status: 400 })
  }

  const link = {
    companyId: body.companyId || null,
    contactId: body.contactId || null,
    dealId: body.dealId || null,
  }

  if (body.kind === 'task') {
    const when = buildDate(body.date, body.time)
    if (isNaN(when.getTime())) return NextResponse.json({ error: 'Érvénytelen dátum/idő.' }, { status: 400 })
    const task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.notes?.trim() || null,
        dueDate: when,
        status: 'pending',
        priority: body.priority || 'medium',
        taskType: 'calendar',
        ...link,
      },
    })
    return NextResponse.json({ ok: true, kind: 'task', id: task.id }, { status: 201 })
  }

  // appointment → Activity (meeting)
  if (!body.time) {
    return NextResponse.json({ error: 'Időponthoz a kezdés (idő) kötelező.' }, { status: 400 })
  }
  const when = buildDate(body.date, body.time)
  if (isNaN(when.getTime())) return NextResponse.json({ error: 'Érvénytelen dátum/idő.' }, { status: 400 })
  const activity = await prisma.activity.create({
    data: {
      type: 'meeting',
      subject: body.title.trim(),
      description: body.notes?.trim() || body.title.trim(),
      activityDate: when,
      duration: body.durationMin ?? null,
      ...link,
    },
  })
  return NextResponse.json({ ok: true, kind: 'appointment', id: activity.id }, { status: 201 })
}
