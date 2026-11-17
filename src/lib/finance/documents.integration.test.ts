/**
 * Integrációs teszt VALÓDI adatbázison — kizárólag helyi tesztadatbázison fut.
 * Futtatás: FINANCE_TEST_DATABASE_URL=postgresql://...@localhost:5432/memini_test npm run test:db
 * Éles/távoli adatbázison SOHA nem fut (a host ellenőrzése kötelező), és csak a
 * három pénzügyi dokumentum-táblát üríti.
 */
import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const URL_ = process.env.FINANCE_TEST_DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_)
const enabled = !!URL_ && isLocal
if (URL_ && !isLocal) throw new Error('A FINANCE_TEST_DATABASE_URL nem helyi adatbázis — a teszt megtagadva.')
const t = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled && 'nincs FINANCE_TEST_DATABASE_URL' }, fn)

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const doc = (n: string, o: Record<string, unknown> = {}) => ({
  original_filename: `${n}.pdf`, sha256: sha(n), kind: 'incoming_invoice' as const,
  external_number: `RE-2026/${n}`, issue_date: '2026-08-10', issuer_name: 'Druck GmbH', issuer_vat_id: 'DE123456789',
  currency: 'EUR', net: 100, vat: 19, gross: 119, ...o,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, svc: typeof import('./documents')

before(async () => {
  if (!enabled) return
  process.env.DATABASE_URL = URL_; process.env.DIRECT_URL = URL_
  const { PrismaClient } = await import('@prisma/client')
  db = new PrismaClient({ datasourceUrl: URL_ })
  svc = await import('./documents')
})
beforeEach(async () => {
  if (!enabled) return
  await db.financialDocumentEvent.deleteMany(); await db.financialDocument.deleteMany(); await db.importBatch.deleteMany()
})
after(async () => { if (db) await db.$disconnect() })

const run = (docs: unknown[], batch?: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc.recordDocuments(docs as any, { actor: 'Arthur', batch: batch as any, db })

t('egy számla importálása → created, ellenőrzésre vár, visszaolvasható', async () => {
  const r = await run([doc('0001')])
  assert.equal(r.status, 'success'); assert.equal(r.summary.created, 1); assert.equal(r.results[0].status, 'needs_review')
  const back = await svc.getDocument(r.results[0].documentId as string, db)
  assert.equal(back?.amounts.gross, 119); assert.equal(back?.amounts.cents.gross, 11900)
  assert.equal(back?.externalNumber, 'RE-2026/0001'); assert.equal(back?.events.length, 1)
})

t('ismételt import → nincs új tétel (idempotens)', async () => {
  await run([doc('0001')])
  const again = await run([doc('0001')])
  assert.equal(again.summary.already_known, 1); assert.equal(again.summary.created, 0)
  assert.equal(await db.financialDocument.count(), 1)
})

t('teljes havi csomag: minden dokumentumról elszámolás, újrafuttatva sem szaporodik', async () => {
  const docs = [
    doc('0001'), doc('0002', { net: 200, vat: 14, gross: 214 }),                       // 7%
    doc('0003', { kind: 'outgoing_invoice', issuer_vat_id: 'HU99999999', issuer_name: 'Memini', vat: 0, gross: 100 }), // 0 ÁFA
    { original_filename: 'bad.pdf', sha256: 'nem-hash', kind: 'other' },               // hibás
    doc('0004', { net: undefined, vat: undefined, gross: undefined }),                  // hiányzó összeg
  ]
  const batch = { filename: 'augusztus.zip', sha256: sha('zip-aug'), total_files: 6, final: true }
  const r = await run(docs, batch)
  const s = r.summary
  assert.equal(s.submitted, 5); assert.equal(s.created + s.already_known + s.rejected + s.error, s.submitted)   // 100% elszámolás
  assert.equal(s.rejected, 1); assert.equal(r.status, 'partial')                        // részleges ≠ siker
  assert.equal(r.batch?.status, 'partial'); assert.equal(r.batch?.storedDocuments, 4)
  const st = await svc.getBatchStatus(batch.sha256, db)
  assert.equal(st?.declaredFiles, 6); assert.equal(st?.unaccounted, 2)                  // a hiányzó nem tűnik el csendben

  const again = await run(docs, batch)
  assert.equal(again.summary.created, 0); assert.equal(again.summary.already_known, 4)
  assert.equal(await db.financialDocument.count(), 4); assert.equal(await db.importBatch.count(), 1)
})

t('hiányzó összeg és eltérő ÁFA: hibás tétel az error-listában, nem tűnik rendben lévőnek', async () => {
  await run([doc('0001', { gross: 120 }), doc('0002', { net: undefined, vat: undefined, gross: undefined }), doc('0003')])
  const errs = await svc.listImportErrors(undefined, db)
  assert.equal(errs.count, 2)
  const codes = errs.documents.flatMap((d) => d.errors.map((e) => e.code)).sort()
  assert.deepEqual(codes, ['AMOUNTS_MISSING', 'SUM_MISMATCH'])
})

t('külföldi (0 ÁFA) számla ellenőrzésre vár figyelmeztetéssel', async () => {
  const r = await run([doc('0001', { vat: 0, gross: 100, issuer_vat_id: 'FR12345678901' })])
  const d = await svc.getDocument(r.results[0].documentId as string, db)
  assert.ok((d?.issues as { code: string }[]).some((i) => i.code === 'ZERO_VAT'))
})

t('sztornó az eredeti számlára hivatkozva → correction, nem duplikátum', async () => {
  const o = await run([doc('0001')])
  const s = await run([doc('ST1', { kind: 'storno', external_number: 'ST-1', related_number: 're 2026/0001', net: -100, vat: -19, gross: -119 })])
  assert.equal(s.results[0].duplicateClass, 'correction'); assert.equal(s.results[0].duplicateOfId, o.results[0].documentId)
  assert.equal(s.results[0].status, 'needs_review')
})

t('az eredeti és a CRM-számlaszám eltérhet: az eredeti marad, a CRM-számla táblához nem nyúlunk', async () => {
  const before = await db.invoice.count(); const beforeExp = await db.expense.count()
  const r = await run([doc('0001', { kind: 'outgoing_invoice', external_number: '2026-08-GABI-17' })])
  const d = await svc.getDocument(r.results[0].documentId as string, db)
  assert.equal(d?.externalNumber, '2026-08-GABI-17'); assert.equal(d?.direction, 'outgoing')
  assert.equal(await db.invoice.count(), before); assert.equal(await db.expense.count(), beforeExp)
})

t('azonos adószám+szám+összeg másik fájlból → duplicate; eltérő szám, azonos esemény → same_event', async () => {
  const o = await run([doc('0001')])
  const dup = await run([doc('0001b', { external_number: 're-2026/0001' })])
  assert.equal(dup.results[0].status, 'duplicate'); assert.equal(dup.results[0].duplicateOfId, o.results[0].documentId)
  assert.equal(dup.results[0].needsHumanDecision, false)
  const ev = await run([doc('X9', { external_number: 'INV-77', issue_date: '2026-08-12' })])
  assert.equal(ev.results[0].duplicateClass, 'same_event'); assert.equal(ev.results[0].status, 'needs_review')
})

t('megszakadt import újraindítása: két hívás, köteg egyben marad, nincs duplikáció', async () => {
  const batch = { filename: 'szept.zip', sha256: sha('zip-sep'), total_files: 3 }
  await run([doc('0001'), doc('0002')], batch)                         // a hívás itt „megszakad"
  const r = await run([doc('0001'), doc('0002'), doc('0003')], { ...batch, final: true })   // újraindítás az elejéről
  assert.equal(r.summary.already_known, 2); assert.equal(r.summary.created, 1)
  assert.equal(r.batch?.storedDocuments, 3); assert.equal(r.batch?.status, 'completed')
  assert.equal(await db.importBatch.count(), 1); assert.equal(await db.financialDocument.count(), 3)
})

t('teljesítmény: 300 dokumentum kötegelve, ismétlés duplikáció nélkül', async () => {
  const docs = Array.from({ length: 300 }, (_, i) => doc(`P${i}`, { external_number: `P-${i}`, issue_date: '2026-01-01', gross: 119 + i, net: 100 + i, vat: 19 }))
  const t0 = Date.now()
  for (let i = 0; i < docs.length; i += 50) await run(docs.slice(i, i + 50))
  const first = Date.now() - t0
  assert.equal(await db.financialDocument.count(), 300)
  const again = await run(docs.slice(0, 50)); assert.equal(again.summary.already_known, 50)
  assert.ok(first < 60_000, `túl lassú: ${first} ms`)
})

// ── Teljes útvonal MCP-n keresztül (a valódi route-handleren) ──────────────
async function mcp(method: string, params: unknown, id: number) {
  process.env.MCP_SECRET = 'teszt-kulcs'
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../../app/api/mcp/route')
  const req = new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-api-key': 'teszt-kulcs' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json() }
}

t('MCP: a pénzügyi eszközök listázva vannak, olvasó/író jelöléssel', async () => {
  const { status, body } = await mcp('tools/list', {}, 1)
  assert.equal(status, 200)
  const tools = body.result.tools as { name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }[]
  const by = Object.fromEntries(tools.map((x) => [x.name, x]))
  for (const n of ['import_financial_batch', 'get_financial_document', 'list_financial_documents', 'get_import_status', 'list_import_errors']) assert.ok(by[n], `hiányzik: ${n}`)
  assert.equal(by.import_financial_batch.annotations.readOnlyHint, false); assert.equal(by.import_financial_batch.annotations.destructiveHint, false)
  assert.equal(by.get_financial_document.annotations.readOnlyHint, true)
  assert.ok(!tools.some((x) => /approve|verify_financial|finalize/.test(x.name) && /financial/.test(x.name)), 'MCP-n nem lehet jóváhagyni')
})

t('MCP: teljes folyamat — import, visszaolvasás, ismétlés, hibás tétel jelzése', async () => {
  const args = { documents: [doc('M1'), doc('M2', { gross: 999 }), { original_filename: 'x.pdf', sha256: 'rossz', kind: 'other' }], batch: { filename: 'mcp.zip', sha256: sha('zip-mcp'), total_files: 3, final: true } }
  const call = await mcp('tools/call', { name: 'import_financial_batch', arguments: args }, 2)
  const rep = JSON.parse(call.body.result.content[0].text)
  assert.equal(rep.status, 'partial'); assert.equal(rep.summary.created, 2); assert.equal(rep.summary.rejected, 1)
  assert.equal(call.body.result.isError, undefined)

  const id = rep.results[0].documentId
  const get = await mcp('tools/call', { name: 'get_financial_document', arguments: { id_or_sha256: id } }, 3)
  assert.equal(JSON.parse(get.body.result.content[0].text).externalNumber, 'RE-2026/M1')

  const again = JSON.parse((await mcp('tools/call', { name: 'import_financial_batch', arguments: args }, 4)).body.result.content[0].text)
  assert.equal(again.summary.created, 0); assert.equal(again.summary.already_known, 2)

  const errs = JSON.parse((await mcp('tools/call', { name: 'list_import_errors', arguments: {} }, 5)).body.result.content[0].text)
  assert.equal(errs.count, 1)                                          // az M2 (nettó+ÁFA≠bruttó)
  const miss = await mcp('tools/call', { name: 'get_financial_document', arguments: { id_or_sha256: 'nincs' } }, 6)
  assert.equal(miss.body.result.isError, true)
})

t('MCP: kulcs nélkül elutasít (jogosultság)', async () => {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../../app/api/mcp/route')
  process.env.MCP_SECRET = 'teszt-kulcs'
  const res = await POST(new NextRequest('http://localhost/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' }))
  assert.equal(res.status, 401)
})
