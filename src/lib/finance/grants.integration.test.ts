/** Delegált jóváhagyás — valódi helyi adatbázison (lásd documents.integration.test.ts). */
import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

const URL_ = process.env.FINANCE_TEST_DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_)
const enabled = !!URL_ && isLocal
if (URL_ && !isLocal) throw new Error('A FINANCE_TEST_DATABASE_URL nem helyi adatbázis — a teszt megtagadva.')
const t = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled && 'nincs FINANCE_TEST_DATABASE_URL' }, fn)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, docs: typeof import('./documents'), rev: typeof import('./review'), orig: typeof import('./originals'), gr: typeof import('./grants')

const pdf = (n: string) => Buffer.from(`%PDF-1.4\n% grant ${n}\n1 0 obj<<>>endobj\n%%EOF\n`)
const memStore = () => ({ put: async (p: string) => p, get: async () => null })
const doc = (n: string, o: Record<string, unknown> = {}) => ({
  original_filename: `${n}.pdf`, sha256: orig.sha256Of(pdf(n)), kind: 'incoming_invoice' as const,
  external_number: `RE-${n}`, issue_date: '2026-08-10', issuer_name: `Lieferant ${n}`, issuer_vat_id: `DE${n.replace(/\D/g, '').padEnd(9, '1')}`,
  currency: 'EUR', net: 100, vat: 19, gross: 119, ...o,
})
const batch = (name: string) => ({ filename: `${name}.zip`, sha256: orig.sha256Of(Buffer.from(`zip-${name}`)), final: true })

before(async () => {
  if (!enabled) return
  process.env.DATABASE_URL = URL_; process.env.DIRECT_URL = URL_
  const { PrismaClient } = await import('@prisma/client')
  db = new PrismaClient({ datasourceUrl: URL_ })
  docs = await import('./documents'); rev = await import('./review'); orig = await import('./originals'); gr = await import('./grants')
})
const clean = async () => {
  await db.financialDocumentEvent.deleteMany(); await db.financialDocument.deleteMany(); await db.importBatch.deleteMany()
  await db.approvalGrant.deleteMany(); await db.expense.deleteMany({ where: { OR: [{ notes: { startsWith: 'Importált bizonylat' } }, { vendor: { startsWith: 'Lieferant' } }] } })
  await db.invoice.deleteMany({ where: { notes: { startsWith: 'Importált bizonylat' } } })
}
beforeEach(async () => { if (enabled) await clean() })
after(async () => { if (!db) return; await clean(); await db.$disconnect() })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const imp = async (items: any[], b?: ReturnType<typeof batch>) => {
  const r = await docs.recordDocuments(items, { actor: 'Arthur', batch: b ?? null, db, autoRecord: false })
  const batchId = r.batch?.id as string
  return { ids: r.results.map((x) => x.documentId as string), batchId }
}
const verify = (n: string) => orig.attachOriginal({ filename: `${n}.pdf`, bytes: pdf(n), actor: 'Laci' }, { db, store: memStore() })
const grant = async (o: Partial<import('./grants').GrantInput> = {}) => {
  const r = await gr.createGrant({ scope: 'window', hours: 24, ...o }, 'laci@memini.test', db)
  assert.ok(r.ok, r.ok ? '' : r.message); return r.ok ? r.grant : null as never
}

t('a felhatalmazás létrehozásának szabályai: lejárat-határ, összeghatár, ismeretlen csomag', async () => {
  assert.equal((await gr.createGrant({ scope: 'window', hours: 0 }, 'l', db)).ok, false)
  assert.equal((await gr.createGrant({ scope: 'window', hours: 24 * 30 }, 'l', db)).ok, false)
  assert.equal((await gr.createGrant({ scope: 'window', hours: 1, maxGrossCents: -5 }, 'l', db)).ok, false)
  assert.equal((await gr.createGrant({ scope: 'batch', hours: 1, batchId: 'nincs' }, 'l', db)).ok, false)
  assert.equal((await gr.createGrant({ scope: 'batch', hours: 1 }, 'l', db)).ok, false)
})

t('felhatalmazás nélkül nem hagyható jóvá semmi (tétel és csomag sem)', async () => {
  const { ids, batchId } = await imp([doc('G1')], batch('a')); await verify('G1')
  const one = await gr.approveDocumentDelegated(ids[0], { actor: 'Arthur' }, db)
  assert.ok(!one.ok && one.code === 'no_grant')
  const all = await gr.approveBatchDelegated(batchId, { actor: 'Arthur' }, db)
  assert.ok(!all.ok && all.code === 'no_grant')
  assert.equal((await db.financialDocument.findUnique({ where: { id: ids[0] } })).status, 'needs_review')
})

t('csomag-jóváhagyás: a hibátlan átmegy, a gyanús/nagy/nem-delegálható emberi döntésre marad; teljes napló', async () => {
  const { ids, batchId } = await imp([
    doc('A1'),                                                                          // tiszta → jóváhagyva
    doc('A2', { vat: 0, gross: 100 }),                                                  // 0 ÁFA jelzés → ember
    doc('A3', { gross: 3000, net: 2521.01, vat: 478.99 }),                              // 2000 EUR felett → ember
    doc('A4', { kind: 'credit_note', net: -100, vat: -19, gross: -119, external_number: 'CN-A4' }), // típus → ember
    doc('A5', { gross: 120 }),                                                          // összeghiba → ember
    doc('A6', { kind: 'outgoing_invoice', issuer_name: 'Memini Design', issuer_vat_id: 'HU12345678' }), // kimenő: rögzül, Expense nélkül
  ], batch('mix'))
  for (const n of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) await verify(n)
  const g = await grant({ scope: 'batch', batchId })
  const r = await gr.approveBatchDelegated(batchId, { actor: 'Arthur' }, db)
  assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.summary.considered, 6); assert.equal(r.summary.approved, 2); assert.equal(r.summary.leftForHuman, 4); assert.equal(r.summary.errors, 0)
  const by = Object.fromEntries(r.items.map((i) => [i.externalNumber, i]))
  assert.equal(by['RE-A1'].outcome, 'approved'); assert.ok(by['RE-A1'].expenseId)
  assert.equal(by['RE-A6'].outcome, 'approved'); assert.equal(by['RE-A6'].expenseId, null)      // kimenő: nincs Expense
  for (const k of ['RE-A2', 'RE-A3', 'CN-A4', 'RE-A5']) assert.equal(by[k].outcome, 'left_for_human', k)

  const d = await db.financialDocument.findUnique({ where: { id: ids[0] }, include: { events: true } })
  assert.equal(d.status, 'recorded'); assert.equal(d.approvalGrantId, g.id); assert.match(d.reviewedBy, /Arthur \(delegálta: laci@memini\.test\)/)
  const ev = d.events.find((e: { action: string }) => e.action === 'reviewed').detail
  assert.equal(ev.initiatedBy, 'laci@memini.test'); assert.equal(ev.executedBy, 'Arthur'); assert.equal(ev.grantId, g.id)
  assert.equal((await db.approvalGrant.findUnique({ where: { id: g.id } })).usedCount, 2)
  for (const id of [ids[1], ids[2], ids[3], ids[4]]) assert.equal((await db.financialDocument.findUnique({ where: { id } })).status, 'needs_review')   // semmi nem ment át csendben

  const again = await gr.approveBatchDelegated(batchId, { actor: 'Arthur' }, db)              // újrafuttatás: nincs új jóváhagyás
  assert.ok(again.ok && again.summary.approved === 0)
  assert.equal(await db.expense.count({ where: { notes: { startsWith: 'Importált bizonylat' } } }), 1)
})

t('az eredeti PDF mellőzése: csak engedélyezett felhatalmazással és indoklással; a mellőzés naplózva', async () => {
  const { ids, batchId } = await imp([doc('W1'), doc('W2'), doc('W3')], batch('waive'))       // egyiknek sincs feltöltött eredetije
  await grant({ scope: 'batch', batchId, allowWaiveOriginal: false })
  const noFlag = await gr.approveDocumentDelegated(ids[0], { actor: 'Arthur', waiveReason: 'Már lekönyvelt csomag, az eredeti a könyvelőnél.' }, db)
  assert.ok(noFlag.ok && noFlag.items[0].outcome === 'left_for_human')

  await db.approvalGrant.deleteMany(); await grant({ scope: 'batch', batchId, allowWaiveOriginal: true })
  const noReason = await gr.approveDocumentDelegated(ids[1], { actor: 'Arthur', waiveReason: 'rövid' }, db)
  assert.ok(noReason.ok && noReason.items[0].outcome === 'left_for_human')
  const ok = await gr.approveDocumentDelegated(ids[2], { actor: 'Arthur', waiveReason: 'Már lekönyvelt csomag, az eredeti a könyvelőnél.' }, db)
  assert.ok(ok.ok && ok.items[0].outcome === 'approved' && ok.items[0].waivedOriginal)
  const d = await db.financialDocument.findUnique({ where: { id: ids[2] }, include: { events: true } })
  assert.match(d.originalWaivedReason, /könyvelőnél/); assert.ok(d.originalWaivedAt); assert.equal(d.hashVerifiedAt, null)
  assert.match(d.events.find((e: { action: string }) => e.action === 'reviewed').detail.originalWaivedReason, /könyvelőnél/)
})

t('amit az ügynök javított, azt nem hagyhatja jóvá; az ember javítása nem akadály', async () => {
  const { ids, batchId } = await imp([doc('C1', { gross: 120 }), doc('C2', { gross: 121 })], batch('fix')); await verify('C1'); await verify('C2')
  await grant({ scope: 'batch', batchId })
  assert.ok((await rev.correctDocument(ids[0], { gross: 119 }, 'Arthur', db)).ok)            // az ügynök javít
  assert.ok((await rev.correctDocument(ids[1], { gross: 119 }, 'laci@memini.test', db)).ok) // az ember javít
  const r = await gr.approveBatchDelegated(batchId, { actor: 'Arthur' }, db)
  assert.ok(r.ok); if (!r.ok) return
  const by = Object.fromEntries(r.items.map((i) => [i.externalNumber, i]))
  assert.equal(by['RE-C1'].outcome, 'left_for_human'); assert.match(by['RE-C1'].reasons[0], /ügynök javította/)
  assert.equal(by['RE-C2'].outcome, 'approved')
})

t('lejárt és visszavont felhatalmazás nem érvényes; a visszavonás nem töröl; csomag-hatókör nem fedi a másikat', async () => {
  const a = await imp([doc('E1')], batch('a1')); const b = await imp([doc('E2')], batch('b1')); await verify('E1'); await verify('E2')
  const gA = await grant({ scope: 'batch', batchId: a.batchId })
  const other = await gr.approveDocumentDelegated(b.ids[0], { actor: 'Arthur' }, db)
  assert.ok(!other.ok && other.code === 'no_grant')                                            // a másik csomag nincs fedve
  await db.approvalGrant.update({ where: { id: gA.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const expired = await gr.approveDocumentDelegated(a.ids[0], { actor: 'Arthur' }, db)
  assert.ok(!expired.ok && expired.code === 'no_grant')
  const gW = await grant({ scope: 'window' })
  assert.ok((await gr.approveDocumentDelegated(a.ids[0], { actor: 'Arthur' }, db)).ok)         // „bármely import" mindkettőt fedi
  await gr.revokeGrant(gW.id, 'laci@memini.test', db)
  const revoked = await gr.approveDocumentDelegated(b.ids[0], { actor: 'Arthur' }, db)
  assert.ok(!revoked.ok && revoked.code === 'no_grant')
  assert.ok((await db.approvalGrant.findUnique({ where: { id: gW.id } })).revokedAt)            // megmarad, nem törlődik
  assert.equal(await gr.listGrants({ activeOnly: true }, db).then((x) => x.length), 0)
})

t('a Könyvelésben már meglévő hasonló költség: az ember igazolással, az ügynök sehogy nem hagyhatja jóvá', async () => {
  await db.expense.create({ data: { date: new Date('2026-08-10T12:00:00Z'), vendor: 'Lieferant S1', description: 'kézzel rögzítve', amount: 100, vatAmount: 19, totalAmount: 119, currency: 'EUR', reference: 'RE-S1', status: 'verified' } })
  const { ids, batchId } = await imp([doc('S1')], batch('sim')); await verify('S1')
  const human = await rev.reviewDocument(ids[0], { action: 'approve' }, 'laci@memini.test', db)
  assert.ok(!human.ok && human.code === 'needs_confirmation'); assert.match(human.ok ? '' : human.message, /már van hasonló költség/)
  await grant({ scope: 'batch', batchId })
  const del = await gr.approveDocumentDelegated(ids[0], { actor: 'Arthur' }, db)
  assert.ok(del.ok && del.items[0].outcome === 'left_for_human')
  assert.ok((await rev.reviewDocument(ids[0], { action: 'approve', confirmDistinct: true }, 'laci@memini.test', db)).ok)
})

// ── MCP-n és API-n keresztül ──────────────────────────────────────────────
async function mcp(name: string, args: unknown, id = 1) {
  process.env.MCP_SECRET = 'teszt-kulcs'
  const { NextRequest } = await import('next/server'); const { POST } = await import('../../app/api/mcp/route')
  const res = await POST(new NextRequest('http://localhost/api/mcp', { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-api-key': 'teszt-kulcs' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) }))
  const j = await res.json(); return { isError: j.result.isError === true, data: JSON.parse(j.result.content[0].text) }
}

t('MCP: felhatalmazás nélkül elutasít; az ember felhatalmazása után jóváhagy; az ügynök által javított marad', async () => {
  const { ids, batchId } = await imp([doc('M1'), doc('M2', { gross: 120 })], batch('mcp')); await verify('M1'); await verify('M2')
  const no = await mcp('approve_financial_batch', { batch_id: batchId })
  assert.ok(no.isError); assert.equal(no.data.code, 'no_grant')
  assert.equal((await mcp('list_approval_grants', {})).data.count, 0)

  const g = await grant({ scope: 'batch', batchId })                                            // ember, a felületen
  const list = (await mcp('list_approval_grants', {})).data
  assert.equal(list.count, 1); assert.equal(list.grants[0].id, g.id); assert.equal(list.grants[0].maxGross, 2000)

  const fix = await mcp('update_financial_document', { document_id: ids[1], gross: 119 })       // az ügynök javít
  assert.equal(fix.data.status, 'success'); assert.match(fix.data.note, /emberi jóváhagyásra/)
  const r = await mcp('approve_financial_batch', { batch_id: batchId })
  assert.ok(!r.isError); assert.equal(r.data.summary.approved, 1); assert.equal(r.data.summary.leftForHuman, 1)
  assert.equal((await db.financialDocument.findUnique({ where: { id: ids[0] } })).status, 'recorded')
  assert.equal((await db.financialDocument.findUnique({ where: { id: ids[1] } })).status, 'needs_review')
})

t('API: felhatalmazás létrehozása és visszavonása bejelentkezés nélkül 401, és nem jön létre semmi', async () => {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../../app/api/finance/grants/route')
  const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ scope: 'window', hours: 24 }) }))
  assert.equal(res.status, 401); assert.equal(await db.approvalGrant.count(), 0)
  const g = await grant()
  const { POST: REVOKE } = await import('../../app/api/finance/grants/[id]/revoke/route')
  assert.equal((await REVOKE(new NextRequest('http://localhost/x', { method: 'POST' }), { params: { id: g.id } })).status, 401)
  assert.equal((await db.approvalGrant.findUnique({ where: { id: g.id } })).revokedAt, null)
})
