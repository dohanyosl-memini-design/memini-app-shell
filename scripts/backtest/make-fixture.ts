// Szintetikus export-fixture a csővezeték API-kulcs nélküli teszteléséhez
// (provider: mock). Determinisztikus; három beültetett mintát tartalmaz:
//   1. MOQ-minta: 5 partner kér kisebb minimum rendelést, hetekre elosztva
//      → a rendszernek hipotézist kell képeznie és meg kell szólalnia.
//   2. Exkluzivitás: 2 partner említi → épphogy hipotézis, gyenge confidence.
//   3. Egyetlen partner 4× ismételt panasza → NEM szabad megszólalnia
//      (a unique-company súlyozás tesztje).
// Plusz zaj: rutin rendelések, számlák, feladatok.
//
// Futtatás: npx tsx scripts/backtest/make-fixture.ts

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ExportSnapshot } from './types'

const BASE = Date.parse('2026-04-01T09:00:00Z')
const day = (n: number, h = 9) => new Date(BASE + n * 86400000 + (h - 9) * 3600000).toISOString()

const companies = [
  'Dom-Shop Heidelberg', 'Ulmer Münster Laden', 'Museumsshop Freiburg',
  'Burg Querfurt Shop', 'Kloster Andechs Laden', 'Schloss Marburg Shop',
  'Touristinfo Bamberg', 'Domschatz Köln Shop',
].map((name, i) => ({
  id: `comp-${String(i + 1).padStart(2, '0')}`,
  name, partnerType: 'gift_shop', classification: 'B', city: name.split(' ').pop()!,
  region: null, country: 'DE', channel: 'direct', notes: null, createdAt: day(-30 - i * 3),
}))

const contacts = companies.map((c, i) => ({
  id: `cont-${String(i + 1).padStart(2, '0')}`,
  name: `Kontakt ${i + 1}`, status: 'customer', companyId: c.id,
  notes: null, createdAt: c.createdAt,
}))

// Beültetett minták aktivitásként (a valóságban telefonjegyzet / levélkivonat).
const moqDays = [5, 12, 19, 33, 41] // 5 különböző partner, ~6 hét alatt
const activities = [
  ...moqDays.map((d, i) => ({
    id: `act-moq-${i}`, type: 'call', subject: 'Rendelési feltételek',
    description: `${companies[i].name} kisebb minimum rendelést (MOQ) kért — a mostani 250 db-os kezdőcsomag túl nagy nekik.`,
    outcome: 'follow-up', activityDate: day(d), companyId: companies[i].id,
    contactId: contacts[i].id, createdAt: day(d),
  })),
  // Exkluzivitás: 2 partner
  ...[8, 27].map((d, i) => ({
    id: `act-exkl-${i}`, type: 'meeting', subject: 'Együttműködés feltételei',
    description: `${companies[i + 5].name} az exkluzivitást hangsúlyozta: a városban más ne árulja ugyanazt a terméket.`,
    outcome: null, activityDate: day(d), companyId: companies[i + 5].id,
    contactId: contacts[i + 5].id, createdAt: day(d),
  })),
  // Egyetlen partner ismételt panasza — NEM szabad insight legyen belőle
  ...[10, 17, 24, 31].map((d, i) => ({
    id: `act-single-${i}`, type: 'call', subject: 'Szállítási idő',
    description: `${companies[7].name} ismét a szállítási időre panaszkodott (fizetési késés is szóba került).`,
    outcome: null, activityDate: day(d), companyId: companies[7].id,
    contactId: contacts[7].id, createdAt: day(d),
  })),
  // Zaj
  ...[3, 9, 15, 22, 29, 36, 43].map((d, i) => ({
    id: `act-noise-${i}`, type: 'email', subject: 'Rutin egyeztetés',
    description: 'Szokásos negyedéves készlet-egyeztetés, különösebb esemény nélkül.',
    outcome: null, activityDate: day(d), companyId: companies[i % 8].id,
    contactId: contacts[i % 8].id, createdAt: day(d),
  })),
]

const orders = [2, 7, 14, 21, 28, 35, 42].map((d, i) => ({
  id: `ord-${i}`, number: `ORD-26${String(i + 1).padStart(3, '0')}`,
  date: day(d), total: 400 + i * 55, notes: null, internalNotes: null,
  deliveryDate: day(d + 4), companyId: companies[(i + 2) % 8].id,
  items: [{ description: 'Hűtőmágnes szett', quantity: 100 + i * 10 }],
}))

const invoices = orders.map((o, i) => ({
  id: `inv-${i}`, number: `INV-26${String(i + 1).padStart(3, '0')}`,
  date: o.date, dueDate: day(2 + i * 7 + 14), total: o.total,
  paidAt: i % 3 === 0 ? null : day(2 + i * 7 + 10), companyId: o.companyId,
}))

const snapshot: ExportSnapshot = {
  exportedAt: new Date(BASE + 50 * 86400000).toISOString(),
  anonymized: false,
  counts: {},
  companies, contacts,
  deals: [], tasks: [], taskEvents: [],
  activities, invoices, orders,
  quotes: [], deliveryNotes: [], memoryEntries: [],
  stockMovements: [], expenses: [], purchaseOrders: [],
}
snapshot.counts = Object.fromEntries(
  Object.entries(snapshot).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length]),
)

const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'sample-export.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(snapshot, null, 1))
console.log(`Fixture kész: ${out}`)
