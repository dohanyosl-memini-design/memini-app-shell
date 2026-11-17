/** Jóváhagyás, javítás, eredeti-csatolás — valódi helyi adatbázison (lásd documents.integration.test.ts). */
import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

const URL_ = process.env.FINANCE_TEST_DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_)
const enabled = !!URL_ && isLocal
if (URL_ && !isLocal) throw new Error('A FINANCE_TEST_DATABASE_URL nem helyi adatbázis — a teszt megtagadva.')
const t = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled && 'nincs FINANCE_TEST_DATABASE_URL' }, fn)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, docs: typeof import('./documents'), rev: typeof import('./review'), orig: typeof import('./originals')

const pdf = (n: string) => Buffer.from(`%PDF-1.4\n% teszt ${n}\n1 0 obj<<>>endobj\n%%EOF\n`)
const memStore = () => {
  const m = new Map<string, Buffer>()
  return { m, put: async (p: string, b: Buffer) => { m.set(p, b); return p }, get: async () => null }
}
const doc = (n: string, o: Record<string, unknown> = {}) => ({
  original_filename: `${n}.pdf`, sha256: orig.sha256Of(pdf(n)), kind: 'incoming_invoice' as const,
  external_number: `RE-${n}`, issue_date: '2026-08-10', issuer_name: 'Druck GmbH', issuer_vat_id: 'DE123456789',
  currency: 'EUR', net: 100, vat: 19, gross: 119, ...o,
})

before(async () => {
  if (!enabled) return
  process.env.DATABASE_URL = URL_; process.env.DIRECT_URL = URL_
  const { PrismaClient } = await import('@prisma/client')
  db = new PrismaClient({ datasourceUrl: URL_ })
  docs = await import('./documents'); rev = await import('./review'); orig = await import('./originals')
})
beforeEach(async () => {
  if (!enabled) return
  await db.financialDocumentEvent.deleteMany(); await db.financialDocument.deleteMany(); await db.importBatch.deleteMany()
  await db.expense.deleteMany({ where: { notes: { startsWith: 'Importált bizonylat' } } })
})
after(async () => {
  if (!db) return
  await db.expense.deleteMany({ where: { notes: { startsWith: 'Importált bizonylat' } } })
  await db.$disconnect()
})

const imp = async (d: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await docs.recordDocuments([d as any], { actor: 'Arthur', db })
  return r.results[0].documentId as string
}
const attach = (n: string, store = memStore()) => orig.attachOriginal({ filename: `${n}.pdf`, bytes: pdf(n), actor: 'Laci' }, { db, store })

// ── eredeti fájl és szerver-oldali hash ───────────────────────────────────
t('egyező fájl → csatolva, a hash igazolt; ismétlés → already_attached', async () => {
  const id = await imp(doc('A1')); const store = memStore()
  const r = await attach('A1', store)
  assert.equal(r.outcome, 'attached'); assert.ok(store.m.has(`finance-originals/${orig.sha256Of(pdf('A1'))}/A1.pdf`))
  const d = await db.financialDocument.findUnique({ where: { id } })
  assert.ok(d.hashVerifiedAt); assert.equal(d.mimeType, 'application/pdf'); assert.equal(d.sizeBytes, pdf('A1').length)
  assert.equal((await attach('A1', store)).outcome, 'already_attached')
})

t('hamis ChatGPT-hash: a fájl nem találja a rekordot, a névegyezőt javasolja; az ember javíthatja a hash-t', async () => {
  const id = await imp(doc('A2', { sha256: 'f'.repeat(64) }))                      // a ChatGPT rosszat számolt
  const r = await attach('A2')
  assert.equal(r.outcome, 'no_record')
  if (r.outcome === 'no_record') { assert.equal(r.candidates.length, 1); assert.equal(r.candidates[0].id, id) }
  const adopted = await orig.attachOriginal({ filename: 'A2.pdf', bytes: pdf('A2'), actor: 'Laci', adoptFor: id }, { db, store: memStore() })
  assert.equal(adopted.outcome, 'hash_adopted')
  const d = await db.financialDocument.findUnique({ where: { id }, include: { events: true } })
  assert.equal(d.sha256, orig.sha256Of(pdf('A2'))); assert.ok(d.hashVerifiedAt)
  assert.ok(d.events.some((e: { action: string }) => e.action === 'corrected'))     // a javítás naplózva
})

t('nem PDF, túl nagy, üres és ismeretlen típus → elutasítás', async () => {
  const mk = (filename: string, bytes: Buffer) => orig.attachOriginal({ filename, bytes, actor: 'Laci' }, { db, store: memStore() })
  assert.equal((await mk('x.pdf', Buffer.from('nem pdf'))).outcome, 'rejected')
  assert.equal((await mk('x.pdf', Buffer.alloc(0))).outcome, 'rejected')
  assert.equal((await mk('x.exe', Buffer.from('MZ'))).outcome, 'rejected')
  assert.equal((await mk('x.pdf', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)]))).outcome, 'rejected')
})

// ── jóváhagyási kapuk és anyagiasítás ─────────────────────────────────────
t('eredeti nélkül nem hagyható jóvá; kivétel csak indokkal', async () => {
  const id = await imp(doc('B1'))
  const r1 = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!r1.ok && r1.code === 'blocked')
  const r2 = await rev.reviewDocument(id, { action: 'approve', overrideNoOriginal: true, note: 'rövid' }, 'Laci', db)
  assert.ok(!r2.ok && r2.code === 'invalid')
  const r3 = await rev.reviewDocument(id, { action: 'approve', overrideNoOriginal: true, note: 'Az eredeti papíron van, később szkenneljük.' }, 'Laci', db)
  assert.ok(r3.ok)
})

t('jóváhagyás eredetivel → recorded + Expense a Könyvelésbe, pontos összegekkel; kétszer nem', async () => {
  const id = await imp(doc('B2', { net: 1097.18, vat: 208.46, gross: 1305.64 })); await attach('B2')
  const r = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(r.ok && r.expenseId)
  const e = await db.expense.findUnique({ where: { id: r.ok ? r.expenseId : '' } })
  assert.equal(e.amount, 1097.18); assert.equal(e.vatAmount, 208.46); assert.equal(e.totalAmount, 1305.64)
  assert.equal(e.vendor, 'Druck GmbH'); assert.equal(e.reference, 'RE-B2'); assert.equal(e.status, 'verified'); assert.equal(e.currency, 'EUR')
  assert.match(e.notes, /Laci/); assert.match(e.receiptUrl, new RegExp(`/api/finance/documents/${id}/original`))
  const again = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!again.ok && again.code === 'conflict')
  assert.equal(await db.expense.count({ where: { notes: { startsWith: 'Importált bizonylat' } } }), 1)
})

t('hibás összeg blokkol; javítás után újraellenőrzés, napló, és jóváhagyható', async () => {
  const id = await imp(doc('B3', { gross: 120 })); await attach('B3')
  const blocked = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!blocked.ok && blocked.code === 'blocked')
  const fixed = await rev.correctDocument(id, { gross: 119 }, 'Laci', db)
  assert.ok(fixed.ok && fixed.changed.includes('grossCents'))
  const d = await db.financialDocument.findUnique({ where: { id }, include: { events: true } })
  assert.deepEqual(d.issues, [])
  const ev = d.events.find((x: { action: string }) => x.action === 'corrected')
  assert.deepEqual(ev.detail.changes.grossCents, { before: 12000, after: 11900 })
  assert.equal(d.sha256, orig.sha256Of(pdf('B3')))                      // az eredeti azonosítója érintetlen
  assert.ok((await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)).ok)
})

t('javításnál az ellentmondó adat elutasítva; változatlan javítás nem hoz létre naplót', async () => {
  const id = await imp(doc('B4'))
  const bad = await rev.correctDocument(id, { issue_date: '2026-02-31' }, 'Laci', db)
  assert.ok(!bad.ok && bad.code === 'invalid')
  const same = await rev.correctDocument(id, { gross: 119 }, 'Laci', db)
  assert.ok(same.ok && same.changed.length === 0)
  assert.equal(await db.financialDocumentEvent.count({ where: { documentId: id, action: 'corrected' } }), 0)
})

t('duplikátum-gyanús tétel: külön igazolás kell a jóváhagyáshoz', async () => {
  await imp(doc('C1'))
  const id = await imp(doc('C2', { external_number: 'INV-9', issue_date: '2026-08-12' })); await attach('C2')   // azonos esemény
  const r1 = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!r1.ok && r1.code === 'needs_confirmation')
  assert.ok((await rev.reviewDocument(id, { action: 'approve', confirmDistinct: true }, 'Laci', db)).ok)
})

t('elutasítás indokkal; utána nem hagyható jóvá; megerősített duplikátum nem keletkeztet tételt', async () => {
  const id = await imp(doc('D1'))
  const noNote = await rev.reviewDocument(id, { action: 'reject', note: 'nem' }, 'Laci', db)
  assert.ok(!noNote.ok && noNote.code === 'invalid')
  const rej = await rev.reviewDocument(id, { action: 'reject', note: 'Nem a Memini-é, tévedésből került be.' }, 'Laci', db)
  assert.ok(rej.ok && rej.document.status === 'rejected')
  const after = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!after.ok && after.code === 'conflict')

  const o = await imp(doc('E1')); await imp(doc('E2', { external_number: 'RE-E1', issue_date: '2026-08-10', sha256: orig.sha256Of(pdf('E2x')) }))
  const dup = await db.financialDocument.findFirst({ where: { status: 'duplicate', duplicateOfId: o } })
  assert.ok(dup)                                                          // adószám+szám+összeg → biztos duplikátum, nem kerül sorba
})

t('kimenő számla és külföldi pénznem: rögzül, de nem megy a Könyvelésbe; a Számlák tábla érintetlen', async () => {
  const inv = await db.invoice.count()
  const out = await imp(doc('F1', { kind: 'outgoing_invoice', issuer_vat_id: 'HU12345678' })); await attach('F1')
  const r = await rev.reviewDocument(out, { action: 'approve' }, 'Laci', db)
  assert.ok(r.ok && r.expenseId === null && r.notes.length > 0)
  const huf = await imp(doc('F2', { currency: 'HUF', net: 10000, vat: 2700, gross: 12700 })); await attach('F2')
  const r2 = await rev.reviewDocument(huf, { action: 'approve' }, 'Laci', db)
  assert.ok(r2.ok && r2.expenseId === null && /nem EUR/.test(r2.notes.join(' ')))
  assert.equal(await db.invoice.count(), inv)
  assert.equal(await db.expense.count({ where: { notes: { startsWith: 'Importált bizonylat' } } }), 0)
})

t('hiányzó nettó: pontos számtannal pótol és jelzi; csak a bruttóból nem találgat', async () => {
  const a = await imp(doc('G1', { net: undefined, vat: 19 })); await attach('G1')
  const r = await rev.reviewDocument(a, { action: 'approve' }, 'Laci', db)
  assert.ok(r.ok && r.notes.some((n) => /nettó = bruttó − ÁFA/.test(n)))
  const b = await imp(doc('G2', { net: undefined, vat: undefined, gross: 77, issue_date: '2026-09-30' })); await attach('G2')   // egyedi: ne legyen duplikátum-gyanú
  const r2 = await rev.reviewDocument(b, { action: 'approve' }, 'Laci', db)
  assert.ok(!r2.ok && r2.code === 'blocked')
})

t('a PATCH végpont bejelentkezés nélkül 401', async () => {
  const id = await imp(doc('H1'))
  const { NextRequest } = await import('next/server')
  const { PATCH } = await import('../../app/api/finance/documents/[id]/route')
  const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) }), { params: { id } })
  assert.equal(res.status, 401)
  assert.equal((await db.financialDocument.findUnique({ where: { id } })).status, 'needs_review')   // semmi nem változott
})
