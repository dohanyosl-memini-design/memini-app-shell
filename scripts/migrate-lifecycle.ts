import { PrismaClient } from '@prisma/client'
import { INACTIVE_AFTER_MONTHS, type LifecycleState } from '../src/lib/lifecycle'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────
// Egyszeri besorolás: a meglévő cégekhez adatból vezeti le a lifecycle-t.
// Alapból CSAK riportot ír (dry-run). Íráshoz: `tsx scripts/migrate-lifecycle.ts --write`
//
// A besorolás sorrendben kiértékelt szabályok szerint (az első illő nyer):
//   van rendelés, utolsó ≤ 12 hó .................. partner
//   van rendelés, utolsó > 12 hó .................. inactive
//   nincs rendelés, de van elfogadott/kiküldött
//     árajánlata VAGY beérkező email tőle ......... interested
//   nincs rendelés, de van kimenő aktivitás/email . cold_lead
//   minden kapcsolat lost, nincs rendelés ......... lost_lead
//   semmi ......................................... prospect
//
// Aki valaha rendelt, azt a gép SOHA nem teszi a temetőbe (lost_partner) —
// az emberi döntés. Minden besorolás kap egy 'migration' forrású naplóbejegyzést.
// ─────────────────────────────────────────────────────────────────────────

const WRITE = process.argv.includes('--write')

function monthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

async function classify(companyId: string): Promise<{ state: LifecycleState; reason: string; firstOrder: Date | null }> {
  const inactiveThreshold = monthsAgo(INACTIVE_AFTER_MONTHS)

  const [orders, quotes, inboundEmails, outboundActivities, contacts] = await Promise.all([
    prisma.order.findMany({
      where: { companyId },
      select: { date: true },
      orderBy: { date: 'asc' },
    }),
    prisma.quote.count({
      where: { companyId, status: { in: ['sent', 'accepted'] } },
    }),
    prisma.emailThread.count({
      where: { companyId },
    }),
    prisma.activity.count({
      where: { companyId },
    }),
    prisma.contact.findMany({
      where: { companyId },
      select: { status: true },
    }),
  ])

  const firstOrder = orders.length ? orders[0].date : null
  const lastOrder = orders.length ? orders[orders.length - 1].date : null

  if (lastOrder) {
    if (lastOrder >= inactiveThreshold) {
      return { state: 'partner', reason: `utolsó rendelés ${lastOrder.toISOString().slice(0, 10)}`, firstOrder }
    }
    return { state: 'inactive', reason: `utolsó rendelés ${lastOrder.toISOString().slice(0, 10)} (> ${INACTIVE_AFTER_MONTHS} hó)`, firstOrder }
  }

  // Innentől: nincs rendelés.
  const allContactsLost = contacts.length > 0 && contacts.every((c) => c.status === 'lost')
  if (allContactsLost) {
    return { state: 'lost_lead', reason: 'migráció: minden kapcsolat elvesztettként volt jelölve', firstOrder: null }
  }

  if (quotes > 0 || inboundEmails > 0) {
    return { state: 'interested', reason: quotes > 0 ? `${quotes} kiküldött/elfogadott ajánlat` : `${inboundEmails} beérkező levél`, firstOrder: null }
  }

  if (outboundActivities > 0) {
    return { state: 'cold_lead', reason: `${outboundActivities} rögzített aktivitás`, firstOrder: null }
  }

  return { state: 'prospect', reason: 'nincs előzmény', firstOrder: null }
}

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, lifecycle: true },
    orderBy: { name: 'asc' },
  })

  console.log(`\n${WRITE ? '✍️  ÍRÁS MÓD' : '👀 DRY-RUN (nem ír, add --write az íráshoz)'}`)
  console.log(`${companies.length} cég vizsgálata…\n`)

  const tally: Record<string, number> = {}

  for (const c of companies) {
    const { state, reason, firstOrder } = await classify(c.id)
    tally[state] = (tally[state] ?? 0) + 1

    console.log(`  ${state.padEnd(13)} ← ${c.name}  (${reason})`)

    if (WRITE) {
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
          data: {
            companyId: c.id,
            fromState: null,
            toState: state,
            reason: lost ? reason : `migráció: ${reason}`,
            source: 'migration',
            actor: 'rendszer',
          },
        }),
      ])
    }
  }

  console.log('\n── Összesítés ──')
  for (const [state, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${state.padEnd(13)} ${count}`)
  }
  console.log(WRITE ? '\n✅ Kész, elmentve.' : '\nℹ️  Riport vége. Íráshoz: tsx scripts/migrate-lifecycle.ts --write')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
