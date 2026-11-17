/**
 * Emberi jóváhagyás és javítás. A szabályokat ITT kényszerítjük ki a szerveren —
 * a felület csak megjeleníti őket. Az ügynök (MCP) ezekhez nem fér hozzá.
 */

import { Prisma, type PrismaClient, type FinancialDocument } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateAmounts, type Issue, type DocKind } from './validate'
import { findDuplicates, type Fingerprint } from './dedupe'
import { decide } from './decide'
import { prepareDocument, type RawDocInput, type Direction } from './prepare'
import { presentDocument } from './documents'

export const MIN_NOTE = 10
const NEEDS_CONFIRM = new Set(['probable', 'same_event', 'correction'])
/** Ezekből lesz Expense (bejövő költség); a többi csak dokumentumként rögzül. */
const EXPENSE_KINDS = new Set(['incoming_invoice', 'receipt'])

export type ReviewInput =
  | { action: 'approve'; note?: string; confirmDistinct?: boolean; overrideNoOriginal?: boolean }
  | { action: 'reject'; note?: string }
  | { action: 'confirm_duplicate'; note?: string }

export type ReviewResult =
  | { ok: true; document: ReturnType<typeof presentDocument>; expenseId: string | null; notes: string[] }
  | { ok: false; code: 'not_found' | 'conflict' | 'blocked' | 'needs_confirmation' | 'invalid'; message: string }

const bad = (code: Exclude<ReviewResult, { ok: true }>['code'], message: string): ReviewResult => ({ ok: false, code, message })

const issuesOf = (d: FinancialDocument) => ((d.issues as unknown as Issue[] | null) ?? [])
const asJson = (v: unknown) => v as Prisma.InputJsonValue

/** Az Expense-hez szükséges három összeg; csak pontos számtannal pótol, találgatás nélkül. */
function expenseAmounts(d: FinancialDocument): { net: number; vat: number; gross: number; derived: string | null } | null {
  const { netCents: n, vatCents: v, grossCents: g } = d
  if (n != null && v != null && g != null) return { net: n, vat: v, gross: g, derived: null }
  if (n != null && g != null) return { net: n, vat: g - n, gross: g, derived: 'ÁFA = bruttó − nettó (a dokumentumon nem szerepelt külön)' }
  if (v != null && g != null) return { net: g - v, vat: v, gross: g, derived: 'nettó = bruttó − ÁFA (a dokumentumon nem szerepelt külön)' }
  return null
}

export interface Delegation { grantId: string; grantedBy: string }

export async function reviewDocument(
  id: string, input: ReviewInput, actor: string, db: PrismaClient = prisma, opts: { delegation?: Delegation } = {},
): Promise<ReviewResult> {
  const delegation = opts.delegation
  const doc = await db.financialDocument.findUnique({ where: { id } })
  if (!doc) return bad('not_found', 'A dokumentum nem található.')
  if (doc.status !== 'needs_review') {
    return bad('conflict', `Csak ellenőrzésre váró tétel módosítható (jelenlegi állapot: ${doc.status}).`)
  }
  const note = (input.note ?? '').trim()

  if (input.action === 'reject') {
    if (note.length < MIN_NOTE) return bad('invalid', `Elutasításhoz indok kell (legalább ${MIN_NOTE} karakter).`)
    const r = await db.$transaction(async (tx) => {
      const u = await tx.financialDocument.update({ where: { id }, data: { status: 'rejected', reviewedBy: actor, reviewedAt: new Date(), reviewNote: note } })
      await tx.financialDocumentEvent.create({ data: { documentId: id, actor, action: 'reviewed', detail: { decision: 'rejected', note } } })
      return u
    })
    return { ok: true, document: presentDocument(r), expenseId: null, notes: [] }
  }

  if (input.action === 'confirm_duplicate') {
    if (!doc.duplicateOfId) return bad('invalid', 'Ennél a tételnél nincs megjelölt eredeti, aminek a duplikátuma lenne.')
    const r = await db.$transaction(async (tx) => {
      const u = await tx.financialDocument.update({ where: { id }, data: { status: 'duplicate', reviewedBy: actor, reviewedAt: new Date(), reviewNote: note || null } })
      await tx.financialDocumentEvent.create({ data: { documentId: id, actor, action: 'reviewed', detail: { decision: 'confirmed_duplicate', of: doc.duplicateOfId, note } } })
      return u
    })
    return { ok: true, document: presentDocument(r), expenseId: null, notes: [] }
  }

  // ── Jóváhagyás: a kapuk ──
  const errors = issuesOf(doc).filter((i) => i.severity === 'error')
  if (errors.length) {
    return bad('blocked', `Hibás adattal nem hagyható jóvá — előbb javítsd: ${errors.map((e) => e.message).join(' | ')}`)
  }
  if (doc.duplicateClass && NEEDS_CONFIRM.has(doc.duplicateClass) && !(input as { confirmDistinct?: boolean }).confirmDistinct) {
    return bad('needs_confirmation', 'Ez a tétel egy meglévőhöz hasonlít (duplikátum-gyanú, azonos esemény vagy helyesbítés). Jóváhagyáshoz külön igazold, hogy különálló tétel.')
  }
  const override = (input as { overrideNoOriginal?: boolean }).overrideNoOriginal === true
  if (!doc.hashVerifiedAt) {
    if (!override) return bad('blocked', 'Az eredeti fájl nincs feltöltve és ellenőrizve. Töltsd fel, vagy indokolt kivételként hagyd jóvá az eredeti nélkül.')
    if (note.length < MIN_NOTE) return bad('invalid', `Az eredeti nélküli jóváhagyáshoz indok kell (legalább ${MIN_NOTE} karakter).`)
  }

  // ── Anyagiasítás: bejövő költségből Expense, a meglévő könyvelési oldalra ──
  const notes: string[] = []
  const expenseLike = EXPENSE_KINDS.has(doc.kind) && doc.direction !== 'outgoing'
  let expenseData: Prisma.ExpenseCreateInput | null = null

  if (expenseLike && !doc.expenseId) {
    if (doc.currency !== 'EUR') {
      notes.push(`A pénznem ${doc.currency ?? 'ismeretlen'}, nem EUR: a költség nem került át a Könyvelésbe, mert az EUR-érték számítását nem találgatjuk. Rögzítsd kézzel a Könyvelés oldalon.`)
    } else {
      const missing = [!doc.issueDate && 'kiállítás dátuma', !doc.issuerName && 'kibocsátó neve'].filter(Boolean)
      const amts = expenseAmounts(doc)
      if (!amts) missing.push('összegek (legalább a bruttó és a nettó vagy az ÁFA)')
      if (missing.length || !amts) return bad('blocked', `A költség rögzítéséhez hiányzik: ${missing.join(', ')}. Javítsd az adatot a szerkesztésnél.`)
      if (amts.derived) notes.push(amts.derived)
      // A Könyvelésben már szereplő hasonló költség (pl. korábban kézzel rögzítve) dupla tételt okozna.
      if (!(input as { confirmDistinct?: boolean }).confirmDistinct) {
        const vendor = { equals: doc.issuerName as string, mode: 'insensitive' as const }
        const similar = await db.expense.findMany({
          where: { OR: [
            ...(doc.externalNumber ? [{ vendor, reference: doc.externalNumber }] : []),
            { vendor, date: doc.issueDate as Date, totalAmount: amts.gross / 100 },
          ] },
          select: { id: true, date: true, vendor: true, totalAmount: true, reference: true }, take: 3,
        })
        if (similar.length) {
          const list = similar.map((e) => `${e.vendor} ${e.reference ?? ''} ${e.totalAmount} (${e.date.toISOString().slice(0, 10)})`).join('; ')
          return bad('needs_confirmation', `A Könyvelésben már van hasonló költség: ${list}. Jóváhagyáshoz igazold, hogy különálló tétel, különben dupla tétel keletkezne.`)
        }
      }
      expenseData = {
        date: doc.issueDate as Date,
        vendor: doc.issuerName as string,
        description: `${doc.kind === 'receipt' ? 'Nyugta' : 'Számla'} ${doc.externalNumber ?? doc.originalFilename}`,
        amount: amts.net / 100, vatAmount: amts.vat / 100, totalAmount: amts.gross / 100,
        currency: 'EUR', reference: doc.externalNumber, status: 'verified',
        receiptUrl: doc.storageUrl ? `/api/finance/documents/${doc.id}/original` : null,
        notes: `Importált bizonylat (${doc.id}), jóváhagyta: ${actor}${amts.derived ? `; ${amts.derived}` : ''}`,
      }
    }
  } else if (!expenseLike) {
    notes.push('Ez a típus (kimenő számla, jóváírás, sztornó, bankkivonat stb.) csak a dokumentumtárban rögzül, a Könyvelés/Számlák táblákba nem kerül át automatikusan.')
  }

  const result = await db.$transaction(async (tx) => {
    const exp = expenseData ? await tx.expense.create({ data: expenseData }) : null
    const waived = !doc.hashVerifiedAt
    const u = await tx.financialDocument.update({
      where: { id },
      data: {
        status: 'recorded', reviewedAt: new Date(), reviewNote: note || null,
        reviewedBy: delegation ? `${actor} (delegálta: ${delegation.grantedBy})` : actor,
        ...(delegation ? { approvalGrantId: delegation.grantId } : {}),
        ...(waived ? { originalWaivedAt: new Date(), originalWaivedReason: note } : {}),
        ...(exp ? { expenseId: exp.id } : {}),
      },
    })
    await tx.financialDocumentEvent.create({
      data: {
        documentId: id, actor, action: 'reviewed',
        detail: asJson({
          decision: 'approved', note, overrideNoOriginal: waived, confirmedDistinct: !!doc.duplicateClass, expenseId: exp?.id ?? null,
          // Ki kezdeményezte, ki hajtotta végre, milyen felhatalmazás alapján, és miért mellőzhető az eredeti.
          initiatedBy: delegation?.grantedBy ?? actor, executedBy: actor, grantId: delegation?.grantId ?? null,
          originalWaivedReason: waived ? note : null,
        }),
      },
    })
    return { u, exp }
  })
  return { ok: true, document: presentDocument(result.u), expenseId: result.exp?.id ?? null, notes }
}

// ─── Javítás ──────────────────────────────────────────────────────────────

export type Patch = Partial<Record<
  'kind' | 'direction' | 'external_number' | 'issue_date' | 'supply_date' | 'due_date' | 'issuer_name' | 'issuer_vat_id'
  | 'recipient_name' | 'recipient_vat_id' | 'currency' | 'net' | 'vat' | 'gross' | 'related_number',
  string | number | null
>>

const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined)
const dec = (c: number | null) => (c == null ? undefined : c / 100)

/**
 * Az kinyert adat javítása (az eredeti fájl érintetlen). Üres szöveg / null = mező törlése.
 * A javítás után újraellenőrzünk és újra duplikáció-vizsgálatot végzünk; minden változás naplózódik.
 */
export async function correctDocument(
  id: string, patch: Patch, actor: string, db: PrismaClient = prisma,
): Promise<{ ok: true; document: ReturnType<typeof presentDocument>; changed: string[] } | { ok: false; code: 'not_found' | 'conflict' | 'invalid'; message: string }> {
  const doc = await db.financialDocument.findUnique({ where: { id } })
  if (!doc) return { ok: false, code: 'not_found', message: 'A dokumentum nem található.' }
  if (doc.status !== 'needs_review') return { ok: false, code: 'conflict', message: `Csak ellenőrzésre váró tétel javítható (állapot: ${doc.status}).` }

  const raw: Record<string, unknown> = {
    original_filename: doc.originalFilename, sha256: doc.sha256, kind: doc.kind, direction: doc.direction ?? undefined,
    external_number: doc.externalNumber ?? undefined, issue_date: toDay(doc.issueDate), supply_date: toDay(doc.supplyDate), due_date: toDay(doc.dueDate),
    issuer_name: doc.issuerName ?? undefined, issuer_vat_id: doc.issuerVatId ?? undefined,
    recipient_name: doc.recipientName ?? undefined, recipient_vat_id: doc.recipientVatId ?? undefined,
    currency: doc.currency ?? undefined, net: dec(doc.netCents), vat: dec(doc.vatCents), gross: dec(doc.grossCents),
    related_number: doc.relatedNumber ?? undefined, mime_type: doc.mimeType ?? undefined, size_bytes: doc.sizeBytes, source: doc.source,
  }
  // Ha csak a típus változik, az irány a típusból következzen (ne ellentmondjon).
  if ('kind' in patch && !('direction' in patch)) raw.direction = undefined
  for (const [k, v] of Object.entries(patch)) raw[k] = v === '' || v === null ? undefined : v

  const prepared = prepareDocument(raw as unknown as RawDocInput)
  if (!prepared.ok) return { ok: false, code: 'invalid', message: prepared.reason }
  const d = prepared.doc

  const next = {
    kind: d.kind, direction: d.direction, externalNumber: d.externalNumber, issueDate: d.issueDate, supplyDate: d.supplyDate, dueDate: d.dueDate,
    issuerName: d.issuerName, issuerVatId: d.issuerVatId, recipientName: d.recipientName, recipientVatId: d.recipientVatId,
    currency: d.currency, netCents: d.netCents, vatCents: d.vatCents, grossCents: d.grossCents, relatedNumber: d.relatedNumber,
  }
  const fmt = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null)
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  for (const k of Object.keys(next) as (keyof typeof next)[]) {
    const before = fmt((doc as unknown as Record<string, unknown>)[k]); const after = fmt(next[k])
    if (before !== after) changes[k] = { before, after }
  }
  const changed = Object.keys(changes)
  if (changed.length === 0) return { ok: true, document: presentDocument(doc), changed }

  const issues = validateAmounts({ kind: next.kind as DocKind, currency: next.currency, netCents: next.netCents, vatCents: next.vatCents, grossCents: next.grossCents })
  const others = await db.financialDocument.findMany({
    where: { id: { not: id } },
    select: { id: true, sha256: true, kind: true, externalNumber: true, relatedNumber: true, issuerVatId: true, issuerName: true, issueDate: true, grossCents: true, currency: true },
    take: 20000,
  })
  const fp: Fingerprint = { id, sha256: doc.sha256, kind: next.kind, externalNumber: next.externalNumber, relatedNumber: next.relatedNumber, issuerVatId: next.issuerVatId, issuerName: next.issuerName, issueDate: next.issueDate, grossCents: next.grossCents, currency: next.currency }
  const decision = decide(issues, findDuplicates(fp, others as Fingerprint[]))

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.financialDocument.update({
      where: { id },
      data: { ...next, issues: asJson(issues), duplicateClass: decision.duplicateClass, duplicateOfId: decision.duplicateOfId, status: decision.status === 'duplicate' ? 'duplicate' : 'needs_review' },
    })
    await tx.financialDocumentEvent.create({ data: { documentId: id, actor, action: 'corrected', detail: asJson({ changes, issues, reasons: decision.reasons }) } })
    return u
  })
  return { ok: true, document: presentDocument(updated), changed }
}
