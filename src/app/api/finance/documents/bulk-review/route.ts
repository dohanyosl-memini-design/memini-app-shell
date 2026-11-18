import { NextRequest, NextResponse } from 'next/server'
import type { FinancialDocument } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sessionActor } from '@/lib/finance/actor'
import { reviewDocument } from '@/lib/finance/review'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Only clean financial records are eligible for the human bulk review.
// All changes are still performed by the existing reviewDocument service,
// which checks Expense duplicates and writes the financial audit trail.
const MAX_PER_REQUEST = 10
const FINANCIAL_KINDS = ['incoming_invoice', 'outgoing_invoice', 'receipt']

function ready(d: FinancialDocument): boolean {
  if (d.status !== 'needs_review') return false
  if (!FINANCIAL_KINDS.includes(d.kind)) return false
  if (d.duplicateClass) return false
  if (Array.isArray(d.issues) && d.issues.length > 0) return false
  if (!Array.isArray(d.issues) && d.issues != null) return false
  if (!d.currency || d.currency !== 'EUR') return false
  if (d.netCents == null || d.vatCents == null || d.grossCents == null) return false
  if (d.netCents + d.vatCents !== d.grossCents) return false
  if (!d.issueDate || !d.issuerName) return false
  if (d.kind === 'outgoing_invoice' && !d.externalNumber) return false
  return true
}

export async function GET() {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const docs = await prisma.financialDocument.findMany({
    where: { status: 'needs_review', kind: { in: FINANCIAL_KINDS } },
    orderBy: { createdAt: 'asc' },
    take: 1000,
  })
  const items = docs.filter(ready).map((d) => ({
    id: d.id,
    originalFilename: d.originalFilename,
    kind: d.kind,
    externalNumber: d.externalNumber,
    issuerName: d.issuerName,
    issueDate: d.issueDate?.toISOString().slice(0, 10) ?? null,
    gross: (d.grossCents ?? 0) / 100,
    originalVerified: !!d.hashVerifiedAt,
  }))
  return NextResponse.json({
    items,
    count: items.length,
    missingOriginal: items.filter((i) => !i.originalVerified).length,
    limitPerRequest: MAX_PER_REQUEST,
    note: 'A szerver újra ellenőrzi a tételeket a véglegesítéskor. Figyelmeztetéses és duplikációgyanús dokumentum nem kerülhet ide.',
  })
}

export async function POST(request: NextRequest) {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (body.confirmReviewed !== true) {
    return NextResponse.json({ error: 'Kifejezett emberi jóváhagyás szükséges.' }, { status: 400 })
  }
  const ids = body.ids
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PER_REQUEST ||
      ids.some((id) => typeof id !== 'string' || id.length > 128) ||
      new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: '1–10 különböző dokumentumazonosító szükséges.' }, { status: 400 })
  }
  const waiveOriginal = body.waiveOriginal === true
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (waiveOriginal && note.length < 10) {
    return NextResponse.json({ error: 'Az eredeti PDF mellőzését legalább tíz karakterrel indokolni kell.' }, { status: 400 })
  }

  const results: { id: string; outcome: 'approved' | 'left_for_human' | 'error'; reason?: string }[] = []
  for (const id of ids as string[]) {
    try {
      const doc = await prisma.financialDocument.findUnique({ where: { id } })
      if (!doc || !ready(doc)) {
        results.push({ id, outcome: 'left_for_human', reason: 'Már nem tiszta, jóváhagyható tétel.' })
        continue
      }
      if (!doc.hashVerifiedAt && !waiveOriginal) {
        results.push({ id, outcome: 'left_for_human', reason: 'Hiányzik a szerver által igazolt eredeti PDF.' })
        continue
      }
      const decision = await reviewDocument(
        id,
        { action: 'approve', note, overrideNoOriginal: !doc.hashVerifiedAt && waiveOriginal, confirmDistinct: false },
        actor,
      )
      results.push(decision.ok
        ? { id, outcome: 'approved' }
        : { id, outcome: 'left_for_human', reason: decision.message })
    } catch (error) {
      results.push({ id, outcome: 'error', reason: error instanceof Error ? error.message : String(error) })
    }
  }
  return NextResponse.json({
    considered: results.length,
    approved: results.filter((r) => r.outcome === 'approved').length,
    leftForHuman: results.filter((r) => r.outcome === 'left_for_human').length,
    errors: results.filter((r) => r.outcome === 'error').length,
    results,
  })
}
