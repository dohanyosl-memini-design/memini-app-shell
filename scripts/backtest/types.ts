// Companion replay-backtest — közös típusok.
//
// A kísérlet tesztelendő hipotézise (előre rögzítve, lásd README):
//   "A Memini múltbeli adataiból időrendben épített observation–hypothesis
//    rendszer képes korábban nem explicit, döntésre alkalmas és bizonyítékokkal
//    alátámasztott felismeréseket előállítani elfogadható zavarási aránnyal."

// ─── Export snapshot ─────────────────────────────────────────────────────────

export interface ExportSnapshot {
  exportedAt: string
  anonymized: boolean
  counts: Record<string, number>
  companies: ExportCompany[]
  contacts: ExportContact[]
  deals: ExportRecord[]
  tasks: ExportRecord[]
  taskEvents: ExportRecord[]
  activities: ExportRecord[]
  invoices: ExportRecord[]
  orders: ExportRecord[]
  quotes: ExportRecord[]
  deliveryNotes: ExportRecord[]
  memoryEntries: ExportRecord[]
  stockMovements: ExportRecord[]
  expenses: ExportRecord[]
  purchaseOrders: ExportRecord[]
}

export interface ExportCompany {
  id: string
  name: string
  partnerType: string | null
  classification: string | null
  city: string | null
  region: string | null
  country: string | null
  channel: string | null
  notes: string | null
  createdAt: string
}

export interface ExportContact {
  id: string
  name: string
  status: string
  companyId: string | null
  notes: string | null
  createdAt: string
}

// Általános rekord: modellenként eltérő mezők, a builder tudja értelmezni.
export type ExportRecord = Record<string, unknown> & { id: string }

// ─── Esemény-réteg (RawEvent) ────────────────────────────────────────────────

export type EventKind =
  | 'company_created' | 'contact_created'
  | 'deal_created' | 'deal_updated'
  | 'task_created' | 'task_event'
  | 'activity'
  | 'invoice_issued' | 'invoice_paid'
  | 'order_placed' | 'order_delivered'
  | 'quote_sent'
  | 'delivery_note'
  | 'memory_entry'
  | 'stock_movement'
  | 'expense'
  | 'purchase_order'

export interface RawEvent {
  id: string
  ts: string                 // ISO — az esemény MEGTÖRTÉNTÉNEK ideje (nem az export ideje)
  kind: EventKind
  companyId: string | null
  companyName: string | null
  summary: string            // tömör, tényszerű, magyar nyelvű leírás a modellnek
  // Mutable entitásnál az export-kori állapot szivároghat a jövőből — az ilyen
  // eseményeket megjelöljük, és a prompt óvatos kezelésre utasít.
  stateAsOfExport?: boolean
}

// ─── Observation ─────────────────────────────────────────────────────────────
// Tényszerű, nem-értelmező megfigyelés. Olcsó, sűrű, archiválható.
// NEM MemoryEntry: a tartós memóriába csak konszolidáció után kerülhetne át.

export interface Observation {
  id: string
  date: string               // YYYY-MM-DD (replay-nap)
  text: string               // tényszerű állítás, interpretáció nélkül
  companyId: string | null
  companyName: string | null
  sourceEventIds: string[]   // bizonyíték-linkek a RawEventekre
  sourceKinds: EventKind[]
}

// ─── Hypothesis ──────────────────────────────────────────────────────────────
// Minden hipotézis a saját halálának feltételével születik (falsifyCondition
// kötelező) és lejárattal. A státuszt és a confidence-t KÓD számolja, nem modell.

export type HypothesisStatus =
  | 'proposed' | 'observed' | 'supported' | 'strong' | 'disproved' | 'expired'

export interface Hypothesis {
  id: string
  bornOn: string             // YYYY-MM-DD
  claim: string
  supportCondition: string   // mikor tekintjük támogatottnak
  falsifyCondition: string   // MI CÁFOLNÁ — kötelező, enélkül a rekord érvénytelen
  expiresOn: string          // bornOn + expiryDays
  status: HypothesisStatus
  supportingObservationIds: string[]
  contradictingObservationIds: string[]
  confidence: number         // 0..1, determinisztikusan számolt (confidence.ts)
  confidenceHistory: { date: string; value: number }[]
  emissions: number          // hányszor szólalt meg ebből a hipotézisből
  lastEmittedOn: string | null
}

// ─── Insight (megszólalás) ───────────────────────────────────────────────────

export interface Insight {
  id: string
  date: string               // melyik replay-napon szólalt volna meg
  hypothesisId: string
  text: string               // amit a Companion mondott volna
  whyNow: string             // miért pont ezen a napon lépte át a küszöböt
  falsifyCondition: string
  confidence: number
  evidence: {
    observationId: string
    date: string
    text: string
    companyName: string | null
  }[]
  uniqueCompanies: number
  contraCount: number
}

// ─── Futás-konfiguráció és metrikák ─────────────────────────────────────────

export interface RunConfig {
  runId: string
  provider: 'anthropic' | 'openai' | 'mock'
  model: string
  exportFile: string
  fromDate: string | null
  toDate: string | null
  maxDays: number | null
  seed: number
  createdAt: string
}

export interface RunMetrics {
  days: number
  daysWithEvents: number
  events: number
  observations: number
  hypothesesBorn: number
  hypothesesDisproved: number
  hypothesesExpired: number
  insightsEmitted: number
  emissionsPerWeek: number   // zavarási ráta — az 5. metrika nyersanyaga
  llmCalls: number
}
