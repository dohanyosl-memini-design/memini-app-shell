// Export snapshot → időrendbe rendezett RawEvent-folyam.
//
// Hindsight-elv: egy eseményt AKKORRA datálunk, amikor megtörtént (date /
// activityDate / createdAt), és a replay adott napján csak az addig történtek
// láthatók. Ismert korlát: a mutable entitások (Deal, Task) mai mezőértékei az
// export-kori állapotot tükrözik — ezeket stateAsOfExport=true jelöli, és a
// prompt óvatos kezelésre utasít. Az append-only források (TaskEvent, Activity,
// számla, rendelés, szállítólevél, készletmozgás) megbízhatók.

import type { EventKind, ExportSnapshot, RawEvent } from './types'

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const n = (v: unknown) => (typeof v === 'number' ? v : 0)
const d = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export function buildEventStream(snap: ExportSnapshot): RawEvent[] {
  const companyName = new Map(snap.companies.map(c => [c.id, c.name]))
  const contactById = new Map(snap.contacts.map(c => [c.id, c]))
  const events: RawEvent[] = []
  let seq = 0

  const push = (
    kind: EventKind, ts: string | null, companyId: unknown, summary: string,
    stateAsOfExport = false,
  ) => {
    if (!ts || !summary.trim()) return
    const cid = typeof companyId === 'string' ? companyId : null
    events.push({
      id: `ev-${String(++seq).padStart(6, '0')}`,
      ts, kind,
      companyId: cid,
      companyName: cid ? companyName.get(cid) ?? null : null,
      summary: summary.trim().slice(0, 600),
      ...(stateAsOfExport ? { stateAsOfExport: true } : {}),
    })
  }

  for (const c of snap.companies) {
    push('company_created', d(c.createdAt), c.id,
      `Új cég a CRM-ben: ${c.name}${c.city ? ` (${c.city})` : ''}${c.partnerType ? `, típus: ${c.partnerType}` : ''}${c.notes ? `. Jegyzet: ${c.notes}` : ''}`)
  }

  for (const c of snap.contacts) {
    const comp = c.companyId ? companyName.get(c.companyId) : null
    push('contact_created', d(c.createdAt), c.companyId,
      `Új kontakt: ${c.name}${comp ? ` (${comp})` : ''}, státusz: ${c.status}${c.notes ? `. Jegyzet: ${c.notes}` : ''}`)
  }

  for (const r of snap.deals) {
    push('deal_created', d(r.createdAt), r.companyId,
      `Deal indult: "${s(r.title)}", érték: ${n(r.value)} EUR${s(r.notes) ? `. Jegyzet: ${s(r.notes)}` : ''}`, true)
    const cr = d(r.createdAt); const up = d(r.updatedAt)
    if (cr && up && up.slice(0, 10) !== cr.slice(0, 10)) {
      push('deal_updated', up, r.companyId,
        `Deal frissült: "${s(r.title)}" — export-kori állapot: ${s(r.stage)}${r.closeDate ? `, zárás: ${s(r.closeDate).slice(0, 10)}` : ''}`, true)
    }
  }

  for (const r of snap.tasks) {
    push('task_created', d(r.createdAt), r.companyId,
      `Feladat létrejött: "${s(r.title)}"${s(r.description) ? ` — ${s(r.description)}` : ''}${s(r.waitingFor) ? `. Várakozás: ${s(r.waitingFor)}` : ''}`, true)
  }

  for (const r of snap.taskEvents) {
    const before = r.before != null ? JSON.stringify(r.before) : ''
    const after = r.after != null ? JSON.stringify(r.after) : ''
    push('task_event', d(r.createdAt), r.companyId,
      `Feladat-esemény (${s(r.actor)}): ${s(r.action)}${s(r.field) ? ` [${s(r.field)}]` : ''}${before ? ` előtte: ${before.slice(0, 120)}` : ''}${after ? ` utána: ${after.slice(0, 120)}` : ''} — feladat: "${s(r.taskTitle)}"`)
  }

  for (const r of snap.activities) {
    const contact = typeof r.contactId === 'string' ? contactById.get(r.contactId) : null
    push('activity', d(r.activityDate) ?? d(r.createdAt), r.companyId,
      `Aktivitás (${s(r.type)})${contact ? ` ${contact.name} kontakttal` : ''}: ${s(r.subject) ? s(r.subject) + ' — ' : ''}${s(r.description)}${s(r.outcome) ? `. Kimenet: ${s(r.outcome)}` : ''}`)
  }

  for (const r of snap.invoices) {
    push('invoice_issued', d(r.date), r.companyId,
      `Számla kiállítva: ${s(r.number)}, ${n(r.total).toFixed(0)} EUR, fizetési határidő: ${s(r.dueDate).slice(0, 10)}`)
    if (r.paidAt) {
      push('invoice_paid', d(r.paidAt), r.companyId,
        `Számla kifizetve: ${s(r.number)}, ${n(r.total).toFixed(0)} EUR`)
    }
  }

  for (const r of snap.orders) {
    const items = Array.isArray(r.items) ? r.items as { description?: string; quantity?: number }[] : []
    const itemStr = items.slice(0, 6).map(i => `${i.quantity ?? '?'}× ${i.description ?? '?'}`).join('; ')
    push('order_placed', d(r.date), r.companyId,
      `Rendelés: ${s(r.number)}, ${n(r.total).toFixed(0)} EUR, ${items.length} tétel${itemStr ? ` (${itemStr})` : ''}${s(r.notes) ? `. Jegyzet: ${s(r.notes)}` : ''}${s(r.internalNotes) ? `. Belső: ${s(r.internalNotes)}` : ''}`)
    if (r.deliveryDate) {
      push('order_delivered', d(r.deliveryDate), r.companyId,
        `Rendelés kiszállítva: ${s(r.number)}`)
    }
  }

  for (const r of snap.quotes) {
    push('quote_sent', d(r.date), r.companyId,
      `Árajánlat: ${s(r.number)}, ${n(r.total).toFixed(0)} EUR${s(r.notes) ? `. Jegyzet: ${s(r.notes)}` : ''}`, true)
  }

  for (const r of snap.deliveryNotes) {
    push('delivery_note', d(r.date), r.companyId,
      `Szállítólevél: ${s(r.number)}, ${n(r.total).toFixed(0)} EUR${s(r.notes) ? `. Jegyzet: ${s(r.notes)}` : ''}`)
  }

  for (const r of snap.memoryEntries) {
    push('memory_entry', d(r.date) ?? d(r.createdAt), r.companyId,
      `Memória-bejegyzés (${s(r.typeLabel) || 'általános'}${s(r.source) ? `, forrás: ${s(r.source)}` : ''}): ${s(r.content)}`)
  }

  for (const r of snap.stockMovements) {
    push('stock_movement', d(r.createdAt), null,
      `Készletmozgás (${s(r.type)}): ${n(r.quantity)} db — ${s(r.productName)}${s(r.note) ? `. ${s(r.note)}` : ''}`)
  }

  for (const r of snap.expenses) {
    push('expense', d(r.date), null,
      `Kiadás: ${s(r.vendor)} — ${s(r.description)}, ${n(r.totalAmount || r.amount).toFixed(0)} ${s(r.currency) || 'EUR'}`)
  }

  for (const r of snap.purchaseOrders) {
    push('purchase_order', d(r.orderedAt) ?? d(r.createdAt), null,
      `Beszerzési rendelés: ${s(r.number)} — ${s(r.supplierName)}${s(r.notes) ? `. ${s(r.notes)}` : ''}`)
  }

  events.sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id))
  return events
}

// Napokra bontás — a replay egysége a nap.
export function groupByDay(events: RawEvent[]): Map<string, RawEvent[]> {
  const byDay = new Map<string, RawEvent[]>()
  for (const ev of events) {
    const day = ev.ts.slice(0, 10)
    const arr = byDay.get(day)
    if (arr) arr.push(ev)
    else byDay.set(day, [ev])
  }
  return byDay
}
