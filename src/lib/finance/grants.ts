/**
 * Delegált jóváhagyás. Az EMBER (webes felület) ad felhatalmazást; az ügynök (MCP)
 * csak ennek keretein belül hagyhat jóvá. A szerver minden tételnél újra ellenőrzi a
 * feltételeket — ami nem felel meg, az emberi döntésre marad, soha nem megy át csendben.
 */

import type { PrismaClient, FinancialDocument, ApprovalGrant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Issue } from './validate'
import { reviewDocument, MIN_NOTE } from './review'

/** Az ügynök-azonosítók: az általuk javított tétel nem hagyható jóvá delegálással. */
export const AGENT_ACTORS = ['Arthur']
/** Delegálással csak ezek hagyhatók jóvá; jóváírás, sztornó, helyesbítő, bankkivonat emberi döntés. */
export const DELEGABLE_KINDS = ['incoming_invoice', 'receipt', 'outgoing_invoice']
export const DEFAULT_MAX_GROSS_CENTS = 200_000 // 2 000 EUR
export const MAX_GRANT_HOURS = 24 * 7

// ─── Felhatalmazások (csak emberi, bejelentkezett felhasználó hozhatja létre) ──

export interface GrantInput {
  scope: 'batch' | 'window'
  batchId?: string | null
  hours: number
  maxGrossCents?: number
  allowWaiveOriginal?: boolean
  note?: string
}

export async function createGrant(input: GrantInput, actor: string, db: PrismaClient = prisma) {
  if (input.scope !== 'batch' && input.scope !== 'window') return { ok: false as const, message: 'Ismeretlen hatókör.' }
  if (!(input.hours > 0) || input.hours > MAX_GRANT_HOURS) return { ok: false as const, message: `A lejárat legfeljebb ${MAX_GRANT_HOURS} óra lehet.` }
  const max = input.maxGrossCents ?? DEFAULT_MAX_GROSS_CENTS
  if (!Number.isInteger(max) || max <= 0) return { ok: false as const, message: 'Az összeghatár pozitív egész cent kell legyen.' }
  if (input.scope === 'batch') {
    if (!input.batchId) return { ok: false as const, message: 'Csomag-hatókörhöz csomag kell.' }
    const b = await db.importBatch.findUnique({ where: { id: input.batchId } })
    if (!b) return { ok: false as const, message: 'A csomag nem található.' }
  }
  const grant = await db.approvalGrant.create({
    data: {
      scope: input.scope, batchId: input.scope === 'batch' ? input.batchId : null, createdBy: actor,
      expiresAt: new Date(Date.now() + input.hours * 3_600_000), maxGrossCents: max,
      allowWaiveOriginal: !!input.allowWaiveOriginal, note: input.note?.trim() || null,
    },
  })
  return { ok: true as const, grant }
}

export async function revokeGrant(id: string, actor: string, db: PrismaClient = prisma) {
  const g = await db.approvalGrant.findUnique({ where: { id } })
  if (!g) return { ok: false as const, message: 'A felhatalmazás nem található.' }
  if (g.revokedAt) return { ok: true as const, grant: g }
  return { ok: true as const, grant: await db.approvalGrant.update({ where: { id }, data: { revokedAt: new Date(), revokedBy: actor } }) }
}

export const isActive = (g: ApprovalGrant, now = new Date()) => !g.revokedAt && g.expiresAt > now

export async function listGrants(opts: { activeOnly?: boolean } = {}, db: PrismaClient = prisma) {
  const rows = await db.approvalGrant.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return rows.filter((g) => !opts.activeOnly || isActive(g))
}

/** A dokumentumot fedő aktív felhatalmazás (a csomag-szintű előnyt élvez az általánossal szemben). */
export async function findGrantFor(doc: Pick<FinancialDocument, 'batchId'>, db: PrismaClient = prisma): Promise<ApprovalGrant | null> {
  const now = new Date()
  const candidates = await db.approvalGrant.findMany({
    where: { revokedAt: null, expiresAt: { gt: now }, OR: [{ scope: 'window' }, ...(doc.batchId ? [{ scope: 'batch', batchId: doc.batchId }] : [])] },
    orderBy: { createdAt: 'desc' },
  })
  return candidates.find((g) => g.scope === 'batch') ?? candidates[0] ?? null
}

// ─── Jogosultsági feltételek (tiszta függvény, külön tesztelhető) ──────────

export type Eligibility = { ok: true; needsWaiver: boolean } | { ok: false; reason: string }

export function eligibility(
  doc: Pick<FinancialDocument, 'status' | 'issues' | 'duplicateClass' | 'kind' | 'grossCents' | 'hashVerifiedAt'>,
  grant: Pick<ApprovalGrant, 'maxGrossCents' | 'allowWaiveOriginal'>,
  ctx: { agentCorrected: boolean; waiveReason?: string },
): Eligibility {
  if (doc.status !== 'needs_review') return { ok: false, reason: `nem vár ellenőrzésre (állapot: ${doc.status})` }
  const issues = (doc.issues as unknown as Issue[] | null) ?? []
  if (issues.length) return { ok: false, reason: `jelzés van rajta: ${issues.map((i) => i.code).join(', ')}` }
  if (doc.duplicateClass) return { ok: false, reason: `duplikáció-gyanú (${doc.duplicateClass})` }
  if (!DELEGABLE_KINDS.includes(doc.kind)) return { ok: false, reason: `a(z) ${doc.kind} típus csak emberi döntéssel hagyható jóvá` }
  if (doc.grossCents == null) return { ok: false, reason: 'nincs bruttó összeg' }
  if (Math.abs(doc.grossCents) > grant.maxGrossCents) return { ok: false, reason: `az összeg meghaladja a felhatalmazás határát (${grant.maxGrossCents / 100})` }
  if (ctx.agentCorrected) return { ok: false, reason: 'az ügynök javította az adatait, ezért emberi jóváhagyás kell (javítás és jóváhagyás nem végezhető ugyanazon fél által)' }
  if (!doc.hashVerifiedAt) {
    if (!grant.allowWaiveOriginal) return { ok: false, reason: 'az eredeti fájl nincs feltöltve, és a felhatalmazás nem engedi a mellőzését' }
    if ((ctx.waiveReason ?? '').trim().length < MIN_NOTE) return { ok: false, reason: `az eredeti mellőzéséhez indoklás kell (legalább ${MIN_NOTE} karakter)` }
    return { ok: true, needsWaiver: true }
  }
  return { ok: true, needsWaiver: false }
}

// ─── Jóváhagyás az ügynök nevében ──────────────────────────────────────────

export interface DelegatedItem {
  documentId: string
  externalNumber: string | null
  outcome: 'approved' | 'left_for_human' | 'error'
  reasons: string[]
  expenseId?: string | null
  waivedOriginal?: boolean
}

async function approveOne(doc: FinancialDocument, grant: ApprovalGrant, actor: string, waiveReason: string | undefined, db: PrismaClient): Promise<DelegatedItem> {
  const base = { documentId: doc.id, externalNumber: doc.externalNumber }
  const corrected = await db.financialDocumentEvent.count({ where: { documentId: doc.id, action: 'corrected', actor: { in: AGENT_ACTORS } } })
  const e = eligibility(doc, grant, { agentCorrected: corrected > 0, waiveReason })
  if (!e.ok) return { ...base, outcome: 'left_for_human', reasons: [e.reason] }
  try {
    const r = await reviewDocument(
      doc.id,
      { action: 'approve', note: e.needsWaiver ? (waiveReason ?? '').trim() : '', overrideNoOriginal: e.needsWaiver, confirmDistinct: false },
      actor, db, { delegation: { grantId: grant.id, grantedBy: grant.createdBy } },
    )
    if (!r.ok) return { ...base, outcome: 'left_for_human', reasons: [r.message] }
    return { ...base, outcome: 'approved', reasons: r.notes, expenseId: r.expenseId, waivedOriginal: e.needsWaiver }
  } catch (err) {
    return { ...base, outcome: 'error', reasons: [err instanceof Error ? err.message : String(err)] }
  }
}

export type DelegatedReport =
  | { ok: false; code: 'not_found' | 'no_grant'; message: string }
  | {
      ok: true
      status: 'success' | 'partial'
      summary: { considered: number; approved: number; waivedOriginal: number; leftForHuman: number; errors: number }
      items: DelegatedItem[]
    }

function report(items: DelegatedItem[]): DelegatedReport {
  const approved = items.filter((i) => i.outcome === 'approved')
  const errors = items.filter((i) => i.outcome === 'error').length
  return {
    ok: true, status: errors ? 'partial' : 'success',
    summary: { considered: items.length, approved: approved.length, waivedOriginal: approved.filter((i) => i.waivedOriginal).length, leftForHuman: items.filter((i) => i.outcome === 'left_for_human').length, errors },
    items,
  }
}

async function bumpUsage(grants: Map<string, number>, db: PrismaClient) {
  for (const [id, n] of Array.from(grants.entries())) if (n > 0) await db.approvalGrant.update({ where: { id }, data: { usedCount: { increment: n } } })
}

export async function approveDocumentDelegated(docId: string, ctx: { actor: string; waiveReason?: string }, db: PrismaClient = prisma): Promise<DelegatedReport> {
  const doc = await db.financialDocument.findUnique({ where: { id: docId } })
  if (!doc) return { ok: false, code: 'not_found', message: 'A dokumentum nem található.' }
  const grant = await findGrantFor(doc, db)
  if (!grant) return { ok: false, code: 'no_grant', message: 'Nincs érvényes felhatalmazás erre a tételre. A felhatalmazást a CRM-ben (Bizonylatok oldal) az emberi felhasználó adhatja meg.' }
  const item = await approveOne(doc, grant, ctx.actor, ctx.waiveReason, db)
  await bumpUsage(new Map([[grant.id, item.outcome === 'approved' ? 1 : 0]]), db)
  return report([item])
}

export async function approveBatchDelegated(batchId: string, ctx: { actor: string; waiveReason?: string }, db: PrismaClient = prisma): Promise<DelegatedReport> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } })
  if (!batch) return { ok: false, code: 'not_found', message: 'A csomag nem található.' }
  const grant = await findGrantFor({ batchId }, db)
  if (!grant) return { ok: false, code: 'no_grant', message: 'Nincs érvényes felhatalmazás erre a csomagra. A felhatalmazást a CRM-ben (Bizonylatok oldal) az emberi felhasználó adhatja meg.' }
  const docs = await db.financialDocument.findMany({ where: { batchId, status: 'needs_review' }, orderBy: { createdAt: 'asc' } })
  const items: DelegatedItem[] = []
  let approved = 0
  for (let i = 0; i < docs.length; i++) {
    const it = await approveOne(docs[i], grant, ctx.actor, ctx.waiveReason, db)
    if (it.outcome === 'approved') approved++
    items.push(it)
  }
  await bumpUsage(new Map([[grant.id, approved]]), db)
  return report(items)
}
