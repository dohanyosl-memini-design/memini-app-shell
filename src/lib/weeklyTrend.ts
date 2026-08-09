import { prisma } from './prisma'
import { localDay, localDayBounds } from './localDay'

/**
 * Heti trend — szándékosan HETI, nem napi bontásban.
 *
 * Napi görbén egy ekkora B2B-cégnél a legtöbb nap nulla rendelés van, így a
 * vonal 90%-ban véletlen ugrálás lenne, és pont a nem létező mintákat lehetne
 * "meglátni" benne. Heti bontásban viszont van értelme a kérdésnek, hogy a
 * megelőző hetek aktivitása (ajánlat, egyeztetés) együtt mozog-e a későbbi
 * bevétellel.
 *
 * A bevétel a BEFOLYT (paid) számlákból jön, nem a kiállítottakból — az a
 * tényleges pénz, nem az ígéret.
 */

export interface WeekPoint {
  /** A hét hétfője, YYYY-MM-DD */
  week: string
  /** Rövid címke a tengelyre, pl. "aug 3." */
  label: string
  bevetelEur: number
  rendelesek: number
  ajanlatok: number
  aktivitasok: number
  feladatokKesz: number
}

export interface WeeklyTrend {
  weeks: WeekPoint[]
  totals: {
    bevetelEur: number
    rendelesek: number
    ajanlatok: number
    aktivitasok: number
    feladatokKesz: number
  }
  /** Van-e egyáltalán értelmezhető mennyiségű adat. */
  sparse: boolean
}

/** Egy időpont helyi hetének hétfője (YYYY-MM-DD). */
function weekStartOf(at: Date): string {
  const dt = new Date(`${localDay(at)}T00:00:00Z`)
  const mondayOffset = (dt.getUTCDay() + 6) % 7 // 0 = hétfő
  dt.setUTCDate(dt.getUTCDate() - mondayOffset)
  return dt.toISOString().slice(0, 10)
}

const MONTHS = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec']

function weekLabel(week: string): string {
  const d = new Date(`${week}T00:00:00Z`)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}.`
}

export async function computeWeeklyTrend(opts: { weeks?: number } = {}): Promise<WeeklyTrend> {
  const weekCount = Math.min(Math.max(opts.weeks ?? 12, 2), 52)

  // A vizsgált ablak: az aktuális hét hétfőjétől visszafelé weekCount-1 hét.
  const thisWeek = weekStartOf(new Date())
  const firstWeekDate = new Date(`${thisWeek}T00:00:00Z`)
  firstWeekDate.setUTCDate(firstWeekDate.getUTCDate() - (weekCount - 1) * 7)
  const firstWeek = firstWeekDate.toISOString().slice(0, 10)

  const from = localDayBounds(firstWeek).start
  const to = localDayBounds(localDay()).end
  const window = { gte: from, lte: to }

  const [paidInvoices, orders, quotes, activities, tasksDone] = await Promise.all([
    prisma.invoice.findMany({ where: { paidAt: window }, select: { paidAt: true, total: true } }),
    prisma.order.findMany({ where: { createdAt: window }, select: { createdAt: true } }),
    prisma.quote.findMany({ where: { sentAt: window }, select: { sentAt: true } }),
    prisma.activity.findMany({ where: { activityDate: window }, select: { activityDate: true } }),
    prisma.task.findMany({ where: { updatedAt: window, status: 'completed' }, select: { updatedAt: true } }),
  ])

  // Üres vázat készítünk minden hétre, hogy a hiányzó hét is 0-val szerepeljen
  // — különben a vonal átugorna felette, és sűrűbbnek látszana az aktivitás.
  const byWeek = new Map<string, WeekPoint>()
  for (let i = 0; i < weekCount; i++) {
    const d = new Date(`${firstWeek}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i * 7)
    const week = d.toISOString().slice(0, 10)
    byWeek.set(week, {
      week, label: weekLabel(week),
      bevetelEur: 0, rendelesek: 0, ajanlatok: 0, aktivitasok: 0, feladatokKesz: 0,
    })
  }

  const add = (at: Date | null, fn: (p: WeekPoint) => void) => {
    if (!at) return
    const p = byWeek.get(weekStartOf(at))
    if (p) fn(p)
  }

  for (const i of paidInvoices) add(i.paidAt, p => { p.bevetelEur += i.total })
  for (const o of orders)       add(o.createdAt, p => { p.rendelesek++ })
  for (const q of quotes)       add(q.sentAt, p => { p.ajanlatok++ })
  for (const a of activities)   add(a.activityDate, p => { p.aktivitasok++ })
  for (const t of tasksDone)    add(t.updatedAt, p => { p.feladatokKesz++ })

  const weeks = Array.from(byWeek.values())
  const totals = weeks.reduce(
    (s, w) => ({
      bevetelEur:    s.bevetelEur + w.bevetelEur,
      rendelesek:    s.rendelesek + w.rendelesek,
      ajanlatok:     s.ajanlatok + w.ajanlatok,
      aktivitasok:   s.aktivitasok + w.aktivitasok,
      feladatokKesz: s.feladatokKesz + w.feladatokKesz,
    }),
    { bevetelEur: 0, rendelesek: 0, ajanlatok: 0, aktivitasok: 0, feladatokKesz: 0 },
  )

  // Ha alig van adat, a trend értelmezhetetlen — ezt jelezzük, nem rajzolunk
  // magabiztos görbét pár pontból.
  const weeksWithAnything = weeks.filter(
    w => w.bevetelEur > 0 || w.rendelesek > 0 || w.ajanlatok > 0 || w.aktivitasok > 0 || w.feladatokKesz > 0,
  ).length

  return { weeks, totals, sparse: weeksWithAnything < 3 }
}
