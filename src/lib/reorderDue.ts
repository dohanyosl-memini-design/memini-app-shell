// Esedékes reorder lista (FÁZIS 3) — won partnerek, akiknek régen volt
// az utolsó teljesített rendelése, plusz reorder-arány KPI és szezon-előtti flag.
// Közös forrás az MCP tool, a REST endpoint és a UI-nézet számára.

import { differenceInMonths, format } from 'date-fns'
import { prisma as defaultPrisma } from './prisma'

// "Teljesített" rendelés = kiszállítva vagy átadva (a sale ténylegesen megtörtént).
// Egy helyen állítható, ha a definíció változna.
export const FULFILLED_ORDER_STATUSES = ['shipped', 'delivered']

export const REORDER_DUE_THRESHOLD_MONTHS = 9
export const REORDER_RATE_TARGET_PCT = 55
export const ESTABLISHED_PARTNER_MONTHS = 12

export interface ReorderDueItem {
  companyId: string
  companyName: string
  contactName: string | null
  lastOrderDate: string          // ISO
  lastOrderValueEur: number
  monthsSinceLastOrder: number
  fulfilledOrderCount: number
  isDue: boolean                 // 9+ hónapja nem rendelt
  isSeasonCall: boolean          // szezon-előtti hívás jelölés
}

export interface ReorderRate {
  reorderedEstablished: number   // számláló: established partnerek 2+ teljesített rendeléssel
  establishedPartners: number    // nevező: partnerek, akiknek első rendelése 12+ hónapja
  ratePct: number | null
  targetPct: number
  meetsTarget: boolean
  partnersWith2PlusOrdersTotal: number  // informatív: összes 2+ rendeléses partner
  label: string                  // "X/Y partner = Z%"
}

export interface ReorderReliability {
  reliable: boolean
  reason: string | null   // ha nem megbízható: miért
}

export interface ReorderDueResult {
  generatedAt: string
  thresholdMonths: number
  fulfilledStatuses: string[]
  // Megbízhatóság: a reorder-lista won partnerekből és teljesített rendelési
  // előzményből dolgozik. Ha ezek nincsenek feltöltve, a "0 esedékes" nem azt
  // jelenti, hogy nincs teendő, hanem hogy a lista nem számítható. Ez a mező
  // teszi egyértelművé, hogy melyikről van szó.
  reliability: ReorderReliability
  reorderRate: ReorderRate
  season: {
    inWindow: boolean            // nov 1 – jan 31
    peakEnd: string | null       // a legutóbbi szezoncsúcs (febr–máj) vége
    note: string
  }
  totals: {
    wonPartners: number
    partnersWithoutFulfilledOrders: number
    listed: number
  }
  items: ReorderDueItem[]        // legrégebbi utolsó rendelés elöl
}

// Nov(10) – Dec(11) – Jan(0) a szezon-előtti hívási ablak.
function isSeasonWindow(now: Date): boolean {
  const m = now.getMonth()
  return m === 10 || m === 11 || m === 0
}

// A legutóbbi (már lezárult) febr–máj szezoncsúcs vége (május 31.).
function mostRecentPeakEnd(now: Date): Date {
  // Június vagy később → az idei máj 31.; január → a tavalyi máj 31.
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return new Date(year, 4, 31, 23, 59, 59)
}

interface RawOrder { companyId: string | null; date: Date; total: number }
interface RawCompany { id: string; name: string; contacts: { firstName: string; lastName: string }[] }

/**
 * Kiszámolja az esedékes reorder listát + a reorder-arány KPI-t.
 * A `now` injektálható a determinisztikus teszthez.
 */
export async function computeReorderDue(
  opts: { thresholdMonths?: number; now?: Date } = {},
  db: typeof defaultPrisma = defaultPrisma
): Promise<ReorderDueResult> {
  const prisma = db
  const now = opts.now ?? new Date()
  const thresholdMonths = opts.thresholdMonths ?? REORDER_DUE_THRESHOLD_MONTHS

  // 1. Won partnerek (cégek, akiknek van won deal-je)
  const wonDeals = (await prisma.deal.findMany({
    where: { stage: 'won', companyId: { not: null } },
    select: { companyId: true },
    distinct: ['companyId'],
  })) as Array<{ companyId: string | null }>
  const partnerIds = wonDeals.map((d) => d.companyId).filter((x): x is string => x != null)

  if (partnerIds.length === 0) {
    return emptyResult(now, thresholdMonths)
  }

  // 2. Cégadatok + első kapcsolattartó
  const companies = (await prisma.company.findMany({
    where: { id: { in: partnerIds } },
    select: {
      id: true,
      name: true,
      contacts: { select: { firstName: true, lastName: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  })) as RawCompany[]
  const companyById = new Map(companies.map((c) => [c.id, c]))

  // 3. Teljesített rendelések partnerenként
  const orders = (await prisma.order.findMany({
    where: { companyId: { in: partnerIds }, status: { in: FULFILLED_ORDER_STATUSES } },
    select: { companyId: true, date: true, total: true },
    orderBy: { date: 'asc' },
  })) as RawOrder[]

  const ordersByCompany = new Map<string, RawOrder[]>()
  for (const o of orders) {
    if (!o.companyId) continue
    const arr = ordersByCompany.get(o.companyId) ?? []
    arr.push(o)
    ordersByCompany.set(o.companyId, arr)
  }

  const inWindow = isSeasonWindow(now)
  const peakEnd = mostRecentPeakEnd(now)

  const items: ReorderDueItem[] = []
  let partnersWithoutFulfilledOrders = 0
  let establishedPartners = 0
  let reorderedEstablished = 0
  let partnersWith2PlusOrdersTotal = 0

  for (const companyId of partnerIds) {
    const company = companyById.get(companyId)
    if (!company) continue
    const companyOrders = ordersByCompany.get(companyId) ?? []

    if (companyOrders.length === 0) {
      partnersWithoutFulfilledOrders++
      continue
    }

    const first = companyOrders[0]
    const last = companyOrders[companyOrders.length - 1]
    const orderCount = companyOrders.length

    // Reorder-arány KPI
    if (orderCount >= 2) partnersWith2PlusOrdersTotal++
    const isEstablished = differenceInMonths(now, new Date(first.date)) >= ESTABLISHED_PARTNER_MONTHS
    if (isEstablished) {
      establishedPartners++
      if (orderCount >= 2) reorderedEstablished++
    }

    // Lista-kritériumok
    const monthsSince = differenceInMonths(now, new Date(last.date))
    const isDue = monthsSince >= thresholdMonths
    const isSeasonCall = inWindow && new Date(last.date).getTime() < peakEnd.getTime()

    if (isDue || isSeasonCall) {
      const contact = company.contacts[0]
      items.push({
        companyId,
        companyName: company.name,
        contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
        lastOrderDate: new Date(last.date).toISOString(),
        lastOrderValueEur: Math.round(last.total * 100) / 100,
        monthsSinceLastOrder: monthsSince,
        fulfilledOrderCount: orderCount,
        isDue,
        isSeasonCall,
      })
    }
  }

  // Rendezés: legrégebbi utolsó rendelés elöl
  items.sort((a, b) => new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime())

  const ratePct = establishedPartners > 0
    ? Math.round((reorderedEstablished / establishedPartners) * 1000) / 10
    : null

  // A lista akkor megbízható, ha van legalább egy won partner, ÉS közülük
  // legalább egynek van teljesített rendelése (különben nincs miből reordert
  // számolni — a 0 az adathiányt tükrözi, nem a valóságot).
  const partnersWithFulfilled = partnerIds.length - partnersWithoutFulfilledOrders
  const reliability: ReorderReliability =
    partnersWithFulfilled > 0
      ? { reliable: true, reason: null }
      : {
          reliable: false,
          reason: `${partnerIds.length} won partner van, de egyiküknek sincs teljesített (kiszállított/átadott) rendelése a rendszerben. A reorder-lista rendelési előzmény nélkül nem számítható — a "0 esedékes" adathiányt jelent, nem azt, hogy nincs teendő.`,
        }

  return {
    generatedAt: now.toISOString(),
    thresholdMonths,
    fulfilledStatuses: FULFILLED_ORDER_STATUSES,
    reliability,
    reorderRate: {
      reorderedEstablished,
      establishedPartners,
      ratePct,
      targetPct: REORDER_RATE_TARGET_PCT,
      meetsTarget: ratePct != null && ratePct >= REORDER_RATE_TARGET_PCT,
      partnersWith2PlusOrdersTotal,
      label: `${reorderedEstablished}/${establishedPartners} partner = ${ratePct ?? '—'}%`,
    },
    season: {
      inWindow,
      peakEnd: inWindow ? peakEnd.toISOString() : null,
      note: inWindow
        ? 'Szezon-előtti ablak (nov–jan): a legutóbbi szezoncsúcs (febr–máj) óta nem rendelő partnerek "szezon-hívás" jelölést kapnak, 9 hónap előtt is.'
        : 'A szezon-hívás jelölés csak a nov 1 – jan 31 ablakban aktív.',
    },
    totals: {
      wonPartners: partnerIds.length,
      partnersWithoutFulfilledOrders,
      listed: items.length,
    },
    items,
  }
}

function emptyResult(now: Date, thresholdMonths: number): ReorderDueResult {
  return {
    generatedAt: now.toISOString(),
    thresholdMonths,
    fulfilledStatuses: FULFILLED_ORDER_STATUSES,
    reliability: {
      reliable: false,
      reason: 'Nincs won státuszú partner a rendszerben. Reorder-lista won partnerek és teljesített rendelési előzmény nélkül nem készíthető — a "0 esedékes" adathiányt jelent, nem tényleges állapotot.',
    },
    reorderRate: {
      reorderedEstablished: 0, establishedPartners: 0, ratePct: null,
      targetPct: REORDER_RATE_TARGET_PCT, meetsTarget: false,
      partnersWith2PlusOrdersTotal: 0, label: '0/0 partner = —%',
    },
    season: { inWindow: isSeasonWindow(now), peakEnd: null, note: 'Nincs won partner.' },
    totals: { wonPartners: 0, partnersWithoutFulfilledOrders: 0, listed: 0 },
    items: [],
  }
}

// A "Hívás ütemezése" akcióhoz: a task standard címe.
export function reorderCallTaskTitle(companyName: string, lastOrderDate: Date | string | null): string {
  const dateStr = lastOrderDate ? format(new Date(lastOrderDate), 'yyyy-MM-dd') : 'nincs'
  return `Reorder hívás – ${companyName} (utolsó rendelés: ${dateStr})`
}
