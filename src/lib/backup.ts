/**
 * Önmagát karbantartó mentés és visszaállítás.
 *
 * A lényeg: NEM sorolunk fel táblákat kézzel. A Prisma ismeri az összes
 * modellt (Prisma.dmmf), és ezen megyünk végig. Így ha egy új funkció új
 * táblát hoz, az AUTOMATIKUSAN bekerül a mentésbe — nem függ attól, hogy
 * valaki emlékszik-e hozzáírni a listához.
 *
 * A visszaállítás a táblák közti kapcsolatok miatt sorrend-érzékeny (a céget
 * előbb kell betölteni, mint a hozzá tartozó számlát), ezért a modelleket
 * topologikusan rendezzük. Az önmagukra hivatkozó táblákat (Goal, MarketingArc,
 * ContentPiece hierarchiák) két lépésben töltjük: előbb a self-FK nélkül,
 * majd egy második körben beállítjuk a szülőket.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const models = Prisma.dmmf.datamodel.models

/** A Prisma-kliens property neve a modellhez: EmailThread → emailThread. */
function clientKey(modelName: string): string {
  return modelName[0].toLowerCase() + modelName.slice(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegate(db: any, modelName: string) {
  return db[clientKey(modelName)]
}

interface FieldMeta { name: string; isDate: boolean }
interface ModelMeta {
  name: string
  scalarFields: FieldMeta[]
  /** Ugyanarra a táblára mutató FK-oszlopok (self-relation), pl. Goal.parentId. */
  selfFkFields: string[]
  /** Más táblákra mutató FK-oszlopok → a hivatkozott modell neve. */
  crossDeps: Set<string>
}

function buildMeta(): ModelMeta[] {
  return models.map((m) => {
    const scalarFields: FieldMeta[] = m.fields
      .filter((f) => f.kind === 'scalar')
      .map((f) => ({ name: f.name, isDate: f.type === 'DateTime' }))

    const selfFkFields: string[] = []
    const crossDeps = new Set<string>()
    for (const f of m.fields) {
      if (f.kind !== 'object') continue
      const from = f.relationFromFields ?? []
      if (from.length === 0) continue // a kapcsolat másik (virtuális) vége
      if (f.type === m.name) {
        selfFkFields.push(...from) // önmagára hivatkozik
      } else {
        crossDeps.add(f.type)
      }
    }
    return { name: m.name, scalarFields, selfFkFields, crossDeps }
  })
}

/**
 * Topologikus sorrend: a hivatkozott (szülő) táblák előbb. A self-relationöket
 * itt figyelmen kívül hagyjuk, azokat a betöltésen belül kezeljük.
 */
function topoOrder(meta: ModelMeta[]): ModelMeta[] {
  const byName = new Map(meta.map((m) => [m.name, m]))
  const visited = new Set<string>()
  const inProgress = new Set<string>()
  const order: ModelMeta[] = []

  const visit = (name: string) => {
    if (visited.has(name)) return
    if (inProgress.has(name)) return // kör esetén megállunk (best effort)
    inProgress.add(name)
    const m = byName.get(name)
    if (m) {
      m.crossDeps.forEach((dep) => {
        if (dep !== name && byName.has(dep)) visit(dep)
      })
      visited.add(name)
      order.push(m)
    }
    inProgress.delete(name)
  }

  for (const m of meta) visit(m.name)
  return order
}

function coerceRow(row: Record<string, unknown>, fields: FieldMeta[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = row[f.name]
    if (v === undefined) continue
    out[f.name] = f.isDate && v !== null ? new Date(v as string) : v
  }
  return out
}

// ─── MENTÉS ──────────────────────────────────────────────────────────────

export interface BackupFile {
  meta: { exportedAt: string; version: string; app: string; models: string[] }
  counts: Record<string, number>
  data: Record<string, unknown[]>
}

/**
 * Minden tábla minden sora, laposan, modellnév szerint kulcsolva.
 * Új tábla automatikusan bekerül — a lista a Prisma modellekből jön.
 */
export async function exportAllData(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}

  for (const m of models) {
    const rows = await delegate(prisma, m.name).findMany()
    data[m.name] = rows
    counts[m.name] = rows.length
  }

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '3.0',
      app: 'Memini CRM',
      models: models.map((m) => m.name),
    },
    counts,
    data,
  }
}

// ─── VISSZAÁLLÍTÁS ───────────────────────────────────────────────────────

// A régi (2.0) mentések kulcsai → modellnév, plusz mely gyerektáblák voltak
// beágyazva a szülőbe. Így a korábban e-mailben kapott mentések is
// visszaállíthatók maradnak.
const V2_ALIASES: Record<string, string> = {
  contacts: 'Contact', companies: 'Company', deals: 'Deal', tasks: 'Task',
  activities: 'Activity', products: 'Product', invoices: 'Invoice',
  quotes: 'Quote', orders: 'Order', deliveryNotes: 'DeliveryNote',
  expenses: 'Expense', recurringExpenses: 'RecurringExpense',
  transactions: 'Transaction', priceListEntries: 'PriceListEntry',
  carriers: 'Carrier', suppliers: 'Supplier', purchaseOrders: 'PurchaseOrder',
  memoryEntryTypes: 'MemoryEntryType', memories: 'MemoryEntry',
  templateTypes: 'TemplateType', templates: 'CommTemplate',
}
// A 2.0-ban beágyazott gyereksorok: szülő-kulcs → [gyerek-mező, gyerek-modell].
const V2_NESTED: Record<string, [string, string][]> = {
  tasks: [['subtasks', 'SubTask']],
  products: [['movements', 'StockMovement']],
  invoices: [['items', 'InvoiceItem']],
  quotes: [['items', 'QuoteItem']],
  orders: [['items', 'OrderItem']],
  deliveryNotes: [['items', 'DeliveryNoteItem']],
  purchaseOrders: [['items', 'PurchaseOrderItem']],
}

/** Bármely mentés-formátumot modellnév→sorok térképpé alakít. */
function normalizeBackup(backup: BackupFile): Record<string, unknown[]> {
  const version = backup.meta?.version ?? ''
  const raw = backup.data ?? {}
  if (version.startsWith('3')) return raw as Record<string, unknown[]>

  // 2.0: kulcs-átnevezés + beágyazott gyereksorok kibontása
  const out: Record<string, unknown[]> = {}
  for (const [key, rows] of Object.entries(raw)) {
    if (!Array.isArray(rows)) continue
    const modelName = V2_ALIASES[key] ?? key
    const nested = V2_NESTED[key] ?? []
    const parents = rows.map((r) => {
      const copy = { ...(r as Record<string, unknown>) }
      for (const [childField, childModel] of nested) {
        const children = copy[childField]
        if (Array.isArray(children)) {
          out[childModel] = (out[childModel] ?? []).concat(children)
        }
        delete copy[childField]
      }
      return copy
    })
    out[modelName] = (out[modelName] ?? []).concat(parents)
  }
  return out
}

export type RestoreMode = 'safe' | 'full'

export interface RestoreResult {
  ok: boolean
  mode: RestoreMode
  inserted: Record<string, number>
  skippedModels: string[]
  error?: string
}

/**
 * Visszaállítás. 'full' módban előbb kiüríti a táblákat (fordított sorrendben),
 * majd betölt. 'safe' módban csak beszúr, meglévőt nem bánt (skipDuplicates).
 */
export async function restoreAllData(backup: BackupFile, mode: RestoreMode): Promise<RestoreResult> {
  const meta = buildMeta()
  const order = topoOrder(meta)
  const byName = new Map(meta.map((m) => [m.name, m]))
  const data = normalizeBackup(backup)
  const inserted: Record<string, number> = {}
  const skippedModels: string[] = []

  try {
    if (mode === 'full') {
      // Fordított sorrend: előbb a gyerek-táblák, aztán a szülők.
      for (const m of [...order].reverse()) {
        await delegate(prisma, m.name).deleteMany()
      }
    }

    for (const m of order) {
      const rows = data[m.name]
      if (!Array.isArray(rows) || rows.length === 0) continue

      const self = m.selfFkFields
      // Első kör: sorok a self-FK-k nélkül (a szülő még nem biztos, hogy létezik).
      const firstPass = rows.map((r) => {
        const row = coerceRow(r as Record<string, unknown>, m.scalarFields)
        for (const fk of self) row[fk] = null
        return row
      })

      const res = await delegate(prisma, m.name).createMany({
        data: firstPass,
        skipDuplicates: mode === 'safe',
      })
      inserted[m.name] = res.count

      // Második kör: a self-FK-k pótlása (hierarchiák).
      if (self.length > 0) {
        for (const r of rows as Record<string, unknown>[]) {
          const patch: Record<string, unknown> = {}
          for (const fk of self) if (r[fk] != null) patch[fk] = r[fk]
          if (Object.keys(patch).length === 0) continue
          await delegate(prisma, m.name).update({ where: { id: r.id }, data: patch }).catch(() => {})
        }
      }
    }

    return { ok: true, mode, inserted, skippedModels }
  } catch (e) {
    return { ok: false, mode, inserted, skippedModels, error: e instanceof Error ? e.message : String(e) }
  }
}

// A visszaállítás sorrendje diagnosztikához (teszt/hibakeresés).
export function _debugOrder(): string[] {
  return topoOrder(buildMeta()).map((m) => m.name)
}
