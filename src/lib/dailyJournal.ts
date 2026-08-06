import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { localDay, dayToDbDate, dbDateToDay } from './localDay'

/**
 * A napi napló írása és olvasása.
 *
 * A nap során NÉGY futás nyúl ugyanahhoz a rekordhoz, ezért itt nincs
 * "mentés", csak HOZZÁÍRÁS: a 16:00-s futás nem törölheti, amit a 12:00-s
 * látott. A napi kulcs egyedi, így az ismételt futás sem duplikál — ugyanazt
 * a rekordot bővíti.
 */

export interface EmailDigestItem {
  from?: string
  subject?: string
  gist?: string
  action?: string
  companyId?: string
}

export interface Checkpoint {
  at: string
  label: string
  note?: string
}

export interface SaveJournalInput {
  /** YYYY-MM-DD, alapértelmezett: mai helyi nap */
  day?: string
  narrative?: string
  /** append = a meglévő szöveg alá fűzi (alapértelmezett), replace = felülírja */
  narrativeMode?: 'append' | 'replace'
  emailDigest?: EmailDigestItem[]
  emailSource?: 'agent' | 'crm'
  priorities?: string[]
  facts?: unknown
  /** Ennek a futásnak a nyoma — pl. { label: '12:00 állapotmentés' } */
  checkpoint?: { label: string; note?: string }
  /** A záró futás jelöli le vele a napot. */
  closeDay?: boolean
  byUser?: boolean
}

export async function saveJournal(input: SaveJournalInput) {
  const day = input.day ?? localDay()
  const date = dayToDbDate(day)
  const now = new Date()

  const existing = await prisma.dailyJournal.findUnique({ where: { date } })

  // Narratíva: alapból hozzáfűzünk, hogy a napközi mentések egymásra épüljenek.
  let narrative = existing?.narrative ?? null
  if (input.narrative !== undefined) {
    const incoming = input.narrative.trim()
    narrative =
      input.narrativeMode === 'replace' || !narrative
        ? incoming
        : `${narrative}\n\n${incoming}`
  }

  const emailDigest = [
    ...((existing?.emailDigest as EmailDigestItem[] | null) ?? []),
    ...(input.emailDigest ?? []),
  ]

  const checkpoints = [...((existing?.checkpoints as Checkpoint[] | null) ?? [])]
  if (input.checkpoint) {
    checkpoints.push({ at: now.toISOString(), label: input.checkpoint.label, note: input.checkpoint.note })
  }

  const data = {
    narrative,
    emailDigest: emailDigest as unknown as Prisma.InputJsonValue,
    checkpoints: checkpoints as unknown as Prisma.InputJsonValue,
    lastSavedAt: now,
    ...(input.emailSource ? { emailSource: input.emailSource } : {}),
    ...(input.priorities ? { priorities: input.priorities as Prisma.InputJsonValue } : {}),
    ...(input.facts !== undefined ? { facts: input.facts as Prisma.InputJsonValue } : {}),
    ...(input.closeDay ? { closedAt: now } : {}),
    ...(input.byUser ? { editedByUser: true } : {}),
  }

  return prisma.dailyJournal.upsert({
    where: { date },
    update: data,
    create: { date, ...data },
  })
}

export async function getJournal(day: string) {
  const row = await prisma.dailyJournal.findUnique({ where: { date: dayToDbDate(day) } })
  return row ? { ...row, date: dbDateToDay(row.date) } : null
}

export async function listJournals(opts: { from?: string; to?: string; limit?: number } = {}) {
  const rows = await prisma.dailyJournal.findMany({
    where: {
      ...(opts.from || opts.to
        ? {
            date: {
              ...(opts.from ? { gte: dayToDbDate(opts.from) } : {}),
              ...(opts.to ? { lte: dayToDbDate(opts.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: 'desc' },
    take: Math.min(Math.max(opts.limit ?? 30, 1), 120),
  })
  return rows.map(r => ({ ...r, date: dbDateToDay(r.date) }))
}
