/**
 * Pénzügyi dokumentumtár — szerver-oldali szolgáltatás (docs/penzugy-terv.md).
 *
 * Az eredeti bizonylat nem módosul; ami rögzül, az a kinyert adat, az ellenőrzés
 * eredménye és a napló. A meglévő Invoice/Expense táblákba ez a réteg NEM ír: a
 * rögzítés (anyagiasítás) a jóváhagyás utáni, külön lépés.
 */

import { Prisma, type PrismaClient, type FinancialDocument } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fromCents } from './money'
import { validateAmounts, type Issue } from './validate'
import { findDuplicates, type Fingerprint } from './dedupe'
import { decide } from './decide'
import { prepareDocument, type RawDocInput, type PreparedDoc } from './prepare'

export interface BatchInput {
  filename: string
  sha256: string
  size_bytes?: number
  total_files?: number
  final?: boolean
}

export interface DocResult {
  index: number
  filename: string
  sha256: string | null
  /** created = új sor; already_known = ugyanaz a fájl már megvan; rejected = hibás bemenet; error = szerverhiba */
  outcome: 'created' | 'already_known' | 'rejected' | 'error'
  documentId?: string
  status?: string
  duplicateClass?: string | null
  duplicateOfId?: string | null
  issues: Issue[]
  reasons: string[]
  needsHumanDecision: boolean
  error?: string
}

export interface RecordReport {
  status: 'success' | 'partial' | 'failed'
  summary: {
    submitted: number
    created: number
    already_known: number
    rejected: number
    error: number
    needs_human_decision: number
  }
  batch: BatchState | null
  results: DocResult[]
}

export interface BatchState {
  id: string
  filename: string
  status: string
  declaredFiles: number
  storedDocuments: number
  byStatus: Record<string, number>
}

const toFingerprint = (d: Pick<FinancialDocument,
  'id' | 'sha256' | 'kind' | 'externalNumber' | 'relatedNumber' | 'issuerVatId' | 'issuerName' | 'issueDate' | 'grossCents' | 'currency'
>): Fingerprint => ({
  id: d.id, sha256: d.sha256, kind: d.kind, externalNumber: d.externalNumber, relatedNumber: d.relatedNumber,
  issuerVatId: d.issuerVatId, issuerName: d.issuerName, issueDate: d.issueDate, grossCents: d.grossCents, currency: d.currency,
})

const FP_SELECT = {
  id: true, sha256: true, kind: true, externalNumber: true, relatedNumber: true,
  issuerVatId: true, issuerName: true, issueDate: true, grossCents: true, currency: true,
} as const

const asJson = (v: unknown) => v as Prisma.InputJsonValue

export async function recordDocuments(
  raws: RawDocInput[],
  ctx: { actor: string; batch?: BatchInput | null; db?: PrismaClient },
): Promise<RecordReport> {
  const db = ctx.db ?? prisma
  const results: DocResult[] = []

  // Köteg (ZIP): az sha256 egyedi, ugyanaz a ZIP újra ugyanazt a köteget adja.
  let batchId: string | null = null
  if (ctx.batch) {
    const b = ctx.batch
    if (!/^[a-fA-F0-9]{64}$/.test(b.sha256 ?? '')) {
      return failedAll(raws, 'A köteg sha256 értéke hibás (64 hex karakter kell).')
    }
    const row = await db.importBatch.upsert({
      where: { sha256: b.sha256.toLowerCase() },
      create: {
        filename: b.filename, sha256: b.sha256.toLowerCase(), sizeBytes: b.size_bytes ?? 0,
        source: 'chatgpt', status: 'processing', totalFiles: b.total_files ?? 0, actor: ctx.actor,
      },
      update: b.total_files != null ? { totalFiles: b.total_files } : {},
    })
    batchId = row.id
  }

  // A dokumentumok száma kicsi (egy kisvállalkozás éves forgalma), ezért az összes
  // ujjlenyomatot betöltjük: így a számlaszám-normalizálás és a hivatkozások is
  // megbízhatóan működnek, nem csak pontos SQL-egyezésnél.
  const known: Fingerprint[] = (await db.financialDocument.findMany({ select: FP_SELECT, take: 20000 })).map(toFingerprint)
  const bySha = new Map(known.filter((k) => k.sha256).map((k) => [k.sha256 as string, k.id as string]))

  for (let index = 0; index < raws.length; index++) {
    const raw = raws[index]
    const filename = raw?.original_filename ?? '(névtelen)'
    const prepared = prepareDocument(raw)
    if (!prepared.ok) {
      results.push({ index, filename, sha256: raw?.sha256 ?? null, outcome: 'rejected', issues: [], reasons: [prepared.reason], needsHumanDecision: true, error: prepared.reason })
      continue
    }
    const doc = prepared.doc

    const existingId = bySha.get(doc.sha256)
    if (existingId) {
      results.push({ index, filename, sha256: doc.sha256, outcome: 'already_known', documentId: existingId, issues: [], reasons: ['Ez az eredeti fájl már szerepel a rendszerben.'], needsHumanDecision: false })
      continue
    }

    try {
      const created = await createOne(db, doc, batchId, ctx.actor, known)
      bySha.set(doc.sha256, created.id)
      known.push(toFingerprint(created))
      results.push({
        index, filename, sha256: doc.sha256, outcome: 'created', documentId: created.id, status: created.status,
        duplicateClass: created.duplicateClass, duplicateOfId: created.duplicateOfId,
        issues: (created.issues as unknown as Issue[]) ?? [], reasons: created.reasons, needsHumanDecision: created.needsHumanDecision,
      })
    } catch (e) {
      // Párhuzamos beküldés: az egyedi sha256 ütközése nem hiba, hanem „már megvan".
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        results.push({ index, filename, sha256: doc.sha256, outcome: 'already_known', issues: [], reasons: ['Ez az eredeti fájl közben már bekerült.'], needsHumanDecision: false })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({ index, filename, sha256: doc.sha256, outcome: 'error', issues: [], reasons: [msg], needsHumanDecision: true, error: msg })
      }
    }
  }

  const batch = batchId ? await refreshBatch(db, batchId, ctx.batch?.final === true, results) : null
  return { status: overall(results), summary: summarize(results), batch, results }
}

async function createOne(db: PrismaClient, d: PreparedDoc, batchId: string | null, actor: string, known: Fingerprint[]) {
  const issues = validateAmounts({
    kind: d.kind, currency: d.currency, netCents: d.netCents, vatCents: d.vatCents,
    grossCents: d.grossCents, lineNetCents: d.lineNetCents,
  })
  const fp: Fingerprint = {
    sha256: d.sha256, kind: d.kind, externalNumber: d.externalNumber, relatedNumber: d.relatedNumber,
    issuerVatId: d.issuerVatId, issuerName: d.issuerName, issueDate: d.issueDate, grossCents: d.grossCents, currency: d.currency,
  }
  const matches = findDuplicates(fp, known)
  const decision = decide(issues, matches)

  const row = await db.$transaction(async (tx) => {
    const r = await tx.financialDocument.create({
      data: {
        batchId, originalFilename: d.originalFilename, sha256: d.sha256, mimeType: d.mimeType, sizeBytes: d.sizeBytes,
        source: d.source, kind: d.kind, direction: d.direction, externalNumber: d.externalNumber,
        issueDate: d.issueDate, supplyDate: d.supplyDate, dueDate: d.dueDate,
        issuerName: d.issuerName, issuerVatId: d.issuerVatId, recipientName: d.recipientName, recipientVatId: d.recipientVatId,
        currency: d.currency, netCents: d.netCents, vatCents: d.vatCents, grossCents: d.grossCents, relatedNumber: d.relatedNumber,
        sourceData: d.sourceData == null ? Prisma.DbNull : asJson(d.sourceData),
        status: decision.status, issues: asJson(issues),
        duplicateClass: decision.duplicateClass, duplicateOfId: decision.duplicateOfId,
        importedBy: actor,
      },
    })
    await tx.financialDocumentEvent.create({
      data: {
        documentId: r.id, actor, action: 'received',
        detail: asJson({ status: decision.status, issues, matches, reasons: decision.reasons }),
      },
    })
    return r
  })
  return { ...row, reasons: decision.reasons, needsHumanDecision: decision.needsHumanDecision }
}

function summarize(results: DocResult[]): RecordReport['summary'] {
  const count = (o: DocResult['outcome']) => results.filter((r) => r.outcome === o).length
  return {
    submitted: results.length,
    created: count('created'), already_known: count('already_known'), rejected: count('rejected'), error: count('error'),
    needs_human_decision: results.filter((r) => r.needsHumanDecision).length,
  }
}

/** Sikert csak akkor jelzünk, ha minden tétel elszámolva és hibátlan; részleges eredményt nem hívunk sikernek. */
function overall(results: DocResult[]): RecordReport['status'] {
  if (results.length === 0) return 'failed'
  const bad = results.filter((r) => r.outcome === 'rejected' || r.outcome === 'error').length
  if (bad === 0) return 'success'
  return bad === results.length ? 'failed' : 'partial'
}

function failedAll(raws: RawDocInput[], reason: string): RecordReport {
  const results: DocResult[] = raws.map((r, index) => ({
    index, filename: r?.original_filename ?? '(névtelen)', sha256: r?.sha256 ?? null, outcome: 'rejected',
    issues: [], reasons: [reason], needsHumanDecision: true, error: reason,
  }))
  return { status: 'failed', summary: summarize(results), batch: null, results }
}

async function refreshBatch(db: PrismaClient, batchId: string, final: boolean, results: DocResult[]): Promise<BatchState> {
  const groups = await db.financialDocument.groupBy({ by: ['status'], where: { batchId }, _count: { _all: true } })
  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
  const stored = groups.reduce((a, g) => a + g._count._all, 0)
  const anyBad = results.some((r) => r.outcome === 'rejected' || r.outcome === 'error')
  const cur = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } })
  const status = final ? (anyBad ? 'partial' : 'completed') : cur.status
  const row = await db.importBatch.update({
    where: { id: batchId },
    data: {
      status,
      recorded: byStatus['recorded'] ?? 0,
      needsReview: byStatus['needs_review'] ?? 0,
      duplicates: byStatus['duplicate'] ?? 0,
      failed: byStatus['error'] ?? 0,
      finishedAt: final ? new Date() : null,
    },
  })
  return { id: row.id, filename: row.filename, status: row.status, declaredFiles: row.totalFiles, storedDocuments: stored, byStatus }
}

// ─── Olvasás ──────────────────────────────────────────────────────────────

const money = (c: number | null) => (c == null ? null : fromCents(c))
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** Olvasható nézet: a centek mellett tizedes érték is, hogy a hívó ne számolgasson. */
export function presentDocument(d: FinancialDocument) {
  return {
    id: d.id, batchId: d.batchId, originalFilename: d.originalFilename, sha256: d.sha256,
    originalFileStored: !!d.storageUrl,
    kind: d.kind, direction: d.direction, status: d.status,
    externalNumber: d.externalNumber, relatedNumber: d.relatedNumber,
    issueDate: iso(d.issueDate), supplyDate: iso(d.supplyDate), dueDate: iso(d.dueDate),
    issuer: { name: d.issuerName, vatId: d.issuerVatId },
    recipient: { name: d.recipientName, vatId: d.recipientVatId },
    currency: d.currency,
    amounts: { net: money(d.netCents), vat: money(d.vatCents), gross: money(d.grossCents), cents: { net: d.netCents, vat: d.vatCents, gross: d.grossCents } },
    issues: d.issues, duplicateClass: d.duplicateClass, duplicateOfId: d.duplicateOfId,
    review: { by: d.reviewedBy, at: d.reviewedAt, note: d.reviewNote },
    links: { invoiceId: d.invoiceId, expenseId: d.expenseId, supplierId: d.supplierId, companyId: d.companyId },
    importedBy: d.importedBy, createdAt: d.createdAt,
  }
}

export async function getDocument(idOrSha: string, db: PrismaClient = prisma) {
  const key = idOrSha.trim()
  const doc = await db.financialDocument.findFirst({
    where: { OR: [{ id: key }, { sha256: key.toLowerCase() }] },
    include: { events: { orderBy: { createdAt: 'asc' } }, batch: { select: { id: true, filename: true, status: true } } },
  })
  if (!doc) return null
  const { events, batch, ...rest } = doc
  return { ...presentDocument(rest as FinancialDocument), sourceData: doc.sourceData, inferredData: doc.inferredData, batch, events }
}

export interface ListFilter {
  status?: string; kind?: string; direction?: string; batchId?: string; limit?: number
}

export async function listDocuments(f: ListFilter, db: PrismaClient = prisma) {
  const where: Prisma.FinancialDocumentWhereInput = {}
  if (f.status) where.status = f.status
  if (f.kind) where.kind = f.kind
  if (f.direction) where.direction = f.direction
  if (f.batchId) where.batchId = f.batchId
  const take = Math.min(Math.max(f.limit ?? 50, 1), 200)
  const [rows, total] = await Promise.all([
    db.financialDocument.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    db.financialDocument.count({ where }),
  ])
  return { total, returned: rows.length, documents: rows.map(presentDocument) }
}

export async function getBatchStatus(idOrSha: string, db: PrismaClient = prisma) {
  const key = idOrSha.trim()
  const b = await db.importBatch.findFirst({ where: { OR: [{ id: key }, { sha256: key.toLowerCase() }] } })
  if (!b) return null
  const groups = await db.financialDocument.groupBy({ by: ['status'], where: { batchId: b.id }, _count: { _all: true } })
  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
  const stored = groups.reduce((a, g) => a + g._count._all, 0)
  const attention = await db.financialDocument.findMany({
    where: { batchId: b.id, status: { in: ['needs_review', 'error', 'duplicate'] } },
    orderBy: { createdAt: 'asc' }, take: 100,
  })
  return {
    batch: { id: b.id, filename: b.filename, status: b.status, startedAt: b.startedAt, finishedAt: b.finishedAt, actor: b.actor },
    declaredFiles: b.totalFiles, storedDocuments: stored, byStatus,
    // Ha a bejelentett darabszám több, mint a tárolt, a különbséget a hívó látja — nem tűnik el csendben.
    unaccounted: b.totalFiles > 0 ? Math.max(b.totalFiles - stored, 0) : null,
    needsAttention: attention.map((d) => ({ id: d.id, filename: d.originalFilename, status: d.status, issues: d.issues, duplicateClass: d.duplicateClass })),
  }
}

/** Azok a dokumentumok, amelyeknél hiba (error súlyú jelzés) van — ezek nem kerülhetnek jóváhagyásra javítás nélkül. */
export async function listImportErrors(batchId: string | undefined, db: PrismaClient = prisma) {
  const rows = await db.financialDocument.findMany({
    where: { ...(batchId ? { batchId } : {}), status: { in: ['needs_review', 'error'] } },
    orderBy: { createdAt: 'desc' }, take: 500,
  })
  const withErrors = rows.filter((d) =>
    d.status === 'error' || ((d.issues as unknown as Issue[] | null) ?? []).some((i) => i.severity === 'error'))
  return {
    count: withErrors.length,
    documents: withErrors.map((d) => ({
      id: d.id, filename: d.originalFilename, status: d.status,
      errors: ((d.issues as unknown as Issue[] | null) ?? []).filter((i) => i.severity === 'error'),
    })),
  }
}
