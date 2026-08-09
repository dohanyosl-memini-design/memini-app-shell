import { prisma } from '@/lib/prisma'
import { INACTIVE_AFTER_MONTHS, type LifecycleState } from '@/lib/lifecycle'

// ─────────────────────────────────────────────────────────────────────────
// Egyszeri besorolás logikája — a meglévő cégekhez adatból vezeti le a
// lifecycle-t. Közös forrás a CLI szkriptnek (scripts/migrate-lifecycle.ts) és
// a védett API-végpontnak (/api/admin/migrate-lifecycle), hogy a kettő ne
// csússzon szét.
//
// Szabályok (az első illő nyer):
//   van rendelés, utolsó ≤ 12 hó .................. partner
//   van rendelés, utolsó > 12 hó .................. inactive
//   nincs rendelés, de van kiküldött/elfogadott
//     árajánlata VAGY beérkező email-szála ........ interested
//   nincs rendelés, de van rögzített aktivitása ... cold_lead
//   minden kapcsolata lost, nincs rendelése ....... lost_lead
//   semmi ......................................... prospect
//
// Aki valaha rendelt, azt a gép SOHA nem teszi a temetőbe.
// ─────────────────────────────────────────────────────────────────────────

export interface Classification {
  state: LifecycleState
  reason: string
  firstOrder: Date | null
}

function monthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

export async function classifyCompany(companyId: string): Promise<Classification> {
  const inactiveThreshold = monthsAgo(INACTIVE_AFTER_MONTHS)

  const [orders, quotes, inboundThreads, activities, contacts] = await Promise.all([
    prisma.order.findMany({ where: { companyId }, select: { date: true }, orderBy: { date: 'asc' } }),
    prisma.quote.count({ where: { companyId, status: { in: ['sent', 'accepted'] } } }),
    prisma.emailThread.count({ where: { companyId } }),
    prisma.activity.count({ where: { companyId } }),
    prisma.contact.findMany({ where: { companyId }, select: { status: true } }),
  ])

  const firstOrder = orders.length ? orders[0].date : null
  const lastOrder = orders.length ? orders[orders.length - 1].date : null

  if (lastOrder) {
    if (lastOrder >= inactiveThreshold) {
      return { state: 'partner', reason: `utolsó rendelés ${lastOrder.toISOString().slice(0, 10)}`, firstOrder }
    }
    return { state: 'inactive', reason: `utolsó rendelés ${lastOrder.toISOString().slice(0, 10)} (> ${INACTIVE_AFTER_MONTHS} hó)`, firstOrder }
  }

  const allContactsLost = contacts.length > 0 && contacts.every((c) => c.status === 'lost')
  if (allContactsLost) {
    return { state: 'lost_lead', reason: 'migráció: minden kapcsolat elvesztettként volt jelölve', firstOrder: null }
  }

  if (quotes > 0 || inboundThreads > 0) {
    return { state: 'interested', reason: quotes > 0 ? `${quotes} kiküldött/elfogadott ajánlat` : `${inboundThreads} beérkező levélszál`, firstOrder: null }
  }

  if (activities > 0) {
    return { state: 'cold_lead', reason: `${activities} rögzített aktivitás`, firstOrder: null }
  }

  return { state: 'prospect', reason: 'nincs előzmény', firstOrder: null }
}

export interface MigrationRow {
  id: string
  name: string
  from: string
  to: LifecycleState
  reason: string
}

export interface MigrationResult {
  dryRun: boolean
  total: number
  tally: Record<string, number>
  rows: MigrationRow[]
}

/**
 * Végigmegy a cégeken és besorolja őket. dryRun=true esetén csak riportot ad,
 * nem ír. Alapból CSAK azokat a cégeket sorolja be, amelyek még érintetlenek
 * (lifecycle = 'prospect' ÉS nincs életciklus-eseményük a létrejövésen túl) —
 * így nem írja felül a kézzel már beállított állapotokat. `all=true`-val minden
 * céget újraértékel.
 */
export async function runLifecycleMigration(opts: { dryRun: boolean; all?: boolean }): Promise<MigrationResult> {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, lifecycle: true },
    orderBy: { name: 'asc' },
  })

  const tally: Record<string, number> = {}
  const rows: MigrationRow[] = []

  for (const c of companies) {
    // Csak az érintetlen (alapállapotú) cégeket soroljuk be, hacsak nem all=true.
    if (!opts.all) {
      if (c.lifecycle !== 'prospect') continue
      const events = await prisma.lifecycleEvent.count({ where: { companyId: c.id, fromState: { not: null } } })
      if (events > 0) continue // már volt kézi/auto léptetése — nem nyúlunk hozzá
    }

    const { state, reason, firstOrder } = await classifyCompany(c.id)
    if (state === c.lifecycle && !opts.all) continue // nincs változás

    tally[state] = (tally[state] ?? 0) + 1
    rows.push({ id: c.id, name: c.name, from: c.lifecycle, to: state, reason })

    if (!opts.dryRun) {
      const lost = state === 'lost_lead' || state === 'lost_partner'
      await prisma.$transaction([
        prisma.company.update({
          where: { id: c.id },
          data: {
            lifecycle: state,
            lifecycleSince: new Date(),
            firstOrderDate: firstOrder,
            lostReason: lost ? reason : null,
            lostAt: lost ? new Date() : null,
          },
        }),
        prisma.lifecycleEvent.create({
          data: { companyId: c.id, fromState: c.lifecycle, toState: state, reason: lost ? reason : `migráció: ${reason}`, source: 'migration', actor: 'rendszer' },
        }),
      ])
    }
  }

  return { dryRun: opts.dryRun, total: rows.length, tally, rows }
}
