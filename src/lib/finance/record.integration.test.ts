/** Közvetlen rögzítés (alapértelmezés): a hibátlan tétel egyből költség / számla lesz. Valódi helyi adatbázison. */
import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

const URL_ = process.env.FINANCE_TEST_DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_)
const enabled = !!URL_ && isLocal
if (URL_ && !isLocal) throw new Error('A FINANCE_TEST_DATABASE_URL nem helyi adatbázis — a teszt megtagadva.')
const t = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled && 'nincs FINANCE_TEST_DATABASE_URL' }, fn)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, docs: typeof import('./documents'), rev: typeof import('./review'), orig: typeof import('./originals')

const bytes = (n: string) => Buffer.from(`%PDF-1.4\n% rec ${n}\n1 0 obj<<>>endobj\n%%EOF\n`)
const sha = (n: string) => orig.sha256Of(bytes(n))
const incoming = (n: string, o: Record<string, unknown> = {}) => ({
  original_filename: `${n}.pdf`, sha256: sha(n), kind: 'incoming_invoice' as const, external_number: `ER-${n}`, issue_date: '2026-08-10',
  issuer_name: `TESTLIEF ${n}`, issuer_vat_id: `DE9${n.replace(/\D/g, '').padEnd(8, '1')}`, currency: 'EUR', net: 100, vat: 19, gross: 119, ...o,
})
const outgoing = (n: string, o: Record<string, unknown> = {}) => ({
  original_filename: `${n}.pdf`, sha256: sha(n), kind: 'outgoing_invoice' as const, external_number: `2026-${n}`, issue_date: '2026-08-12', due_date: '2026-08-26',
  issuer_name: 'Memini Design', issuer_vat_id: 'HU12345678', recipient_name: 'TESTCO Burg GmbH', recipient_vat_id: 'DE811111111',
  currency: 'EUR', net: 200, vat: 0, gross: 200, ...o,
})

const clean = async () => {
  await db.financialDocumentEvent.deleteMany(); await db.financialDocument.deleteMany(); await db.importBatch.deleteMany(); await db.approvalGrant.deleteMany()
  await db.expense.deleteMany({ where: { OR: [{ notes: { startsWith: 'Importált bizonylat' } }, { vendor: { startsWith: 'TESTLIEF' } }] } })
  await db.invoice.deleteMany({ where: { OR: [{ notes: { startsWith: 'Importált bizonylat' } }, { number: { startsWith: 'TESTNUM' } }] } })
  await db.company.deleteMany({ where: { name: { startsWith: 'TESTCO' } } })
}
before(async () => {
  if (!enabled) return
  process.env.DATABASE_URL = URL_; process.env.DIRECT_URL = URL_
  const { PrismaClient } = await import('@prisma/client')
  db = new PrismaClient({ datasourceUrl: URL_ })
  docs = await import('./documents'); rev = await import('./review'); orig = await import('./originals')
})
beforeEach(async () => {
  if (!enabled) return
  await clean()
  await db.company.create({ data: { name: 'TESTCO Burg GmbH', vatId: 'DE 811 111 111' } })
})
after(async () => { if (!db) return; await clean(); await db.$disconnect() })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (items: any[], extra: Record<string, unknown> = {}) => docs.recordDocuments(items, { actor: 'Arthur', db, ...extra })
const exp = (vendor: string) => db.expense.findFirst({ where: { vendor } })

t('bejövő számla egyből költség lesz a Könyvelésben, jóváhagyás nélkül', async () => {
  const r = await run([incoming('B1', { net: 1097.18, vat: 208.46, gross: 1305.64 })])
  assert.equal(r.status, 'success'); assert.equal(r.results[0].status, 'recorded'); assert.equal(r.results[0].recordedAs, 'expense')
  assert.equal(r.summary.recorded, 1); assert.equal(r.summary.needs_human_decision, 0)
  const e = await exp('TESTLIEF B1')
  assert.equal(e.amount, 1097.18); assert.equal(e.totalAmount, 1305.64); assert.equal(e.reference, 'ER-B1'); assert.equal(e.status, 'verified')
  const d = await db.financialDocument.findUnique({ where: { id: r.results[0].documentId }, include: { events: true } })
  assert.equal(d.reviewedBy, 'automatikus (import)'); assert.equal(d.expenseId, e.id); assert.equal(d.hashVerifiedAt, null)   // az eredeti később feltölthető
  assert.deepEqual(d.events.map((x: { action: string }) => x.action).sort(), ['received', 'recorded'])
  assert.deepEqual(r.recordedTotals, { 'incoming:EUR': { count: 1, gross: 1305.64 } })
})

t('kimenő számla egyből a Számlák közé kerül, a vevőhöz kötve (adószám formátum-eltéréssel is); 0 ÁFA nem akadály', async () => {
  const r = await run([outgoing('K1')])
  assert.equal(r.results[0].status, 'recorded'); assert.equal(r.results[0].recordedAs, 'invoice')
  const inv = await db.invoice.findUnique({ where: { number: '2026-K1' }, include: { items: true, company: true } })
  assert.equal(inv.total, 200); assert.equal(inv.vatAmount, 0); assert.equal(inv.status, 'open'); assert.equal(inv.currency, 'EUR')
  assert.equal(inv.company.name, 'TESTCO Burg GmbH'); assert.equal(inv.billingName, 'TESTCO Burg GmbH')
  assert.equal(inv.items.length, 1); assert.equal(inv.dueDate.toISOString().slice(0, 10), '2026-08-26')
  assert.equal(r.results[0].invoiceId, inv.id)
})

t('ismeretlen vevő: a számla partner nélkül rögzül és jelzi; név alapján is köt', async () => {
  const unknown = await run([outgoing('K2', { recipient_name: 'Ismeretlen Kft', recipient_vat_id: 'DE000000000' })])
  assert.equal(unknown.results[0].status, 'recorded'); assert.match(unknown.results[0].notes?.join(' ') ?? '', /nem található a CRM-ben/)
  assert.equal((await db.invoice.findUnique({ where: { number: '2026-K2' } })).companyId, null)
  const byName = await run([outgoing('K3', { recipient_name: 'testco burg gmbh', recipient_vat_id: undefined })])
  assert.ok((await db.invoice.findUnique({ where: { number: '2026-K3' } })).companyId)
})

t('fizetési állapot: csak ha a dokumentum jelzi; különben nyitott', async () => {
  await run([outgoing('P1', { payment_status: 'paid', paid_date: '2026-08-20' }), outgoing('P2', { net: 300, gross: 300 })])
  const paid = await db.invoice.findUnique({ where: { number: '2026-P1' } }); const open = await db.invoice.findUnique({ where: { number: '2026-P2' } })
  assert.equal(paid.status, 'paid'); assert.equal(paid.paidAt.toISOString().slice(0, 10), '2026-08-20')
  assert.equal(open.status, 'open'); assert.equal(open.paidAt, null)
})

t('kivételek nem rögzülnek: összeghiba, hiányzó összeg, hiányzó számlaszám — emberre várnak, semmi nem jön létre', async () => {
  const r = await run([incoming('X1', { gross: 120 }), incoming('X2', { net: undefined, vat: undefined, gross: undefined }), outgoing('X3', { external_number: undefined })])
  assert.deepEqual(r.results.map((x) => x.status), ['needs_review', 'needs_review', 'needs_review'])
  assert.equal(r.summary.recorded, 0); assert.equal(r.summary.needs_human_decision, 3)
  assert.equal(await db.expense.count({ where: { vendor: { startsWith: 'TESTLIEF' } } }), 0)
  assert.equal(await db.invoice.count({ where: { notes: { startsWith: 'Importált bizonylat' } } }), 0)
})

t('foglalt számlaszám: a meglévő számlát nem írja felül, a tétel kivételként vár', async () => {
  await db.invoice.create({ data: { number: '2026-N1', date: new Date(), dueDate: new Date(), subtotal: 1, vatAmount: 0, total: 1, notes: 'TESTNUM kézzel' } })
  await db.invoice.updateMany({ where: { number: '2026-N1' }, data: { number: 'TESTNUM-x' } })      // takarításhoz jelölve, de a szám alább más
  await db.invoice.create({ data: { number: '2026-N2', date: new Date(), dueDate: new Date(), subtotal: 5, vatAmount: 0, total: 5, notes: 'kézzel rögzítve' } })
  const r = await run([outgoing('N2', { external_number: '2026-N2' })])
  assert.equal(r.results[0].status, 'needs_review'); assert.match(r.results[0].reasons.join(' '), /már szerepel a Számlák között/)
  assert.equal((await db.invoice.findUnique({ where: { number: '2026-N2' } })).total, 5)             // érintetlen
  await db.invoice.deleteMany({ where: { number: { in: ['2026-N2', 'TESTNUM-x'] } } })
})

t('a Könyvelésben már szereplő hasonló költség: nem duplázza, kivételként vár', async () => {
  await db.expense.create({ data: { date: new Date('2026-08-10T12:00:00Z'), vendor: 'TESTLIEF S1', description: 'kézzel', amount: 100, vatAmount: 19, totalAmount: 119, currency: 'EUR', reference: 'ER-S1', status: 'verified' } })
  const r = await run([incoming('S1')])
  assert.equal(r.results[0].status, 'needs_review'); assert.match(r.results[0].reasons.join(' '), /hasonló költség/)
  assert.equal(await db.expense.count({ where: { vendor: 'TESTLIEF S1' } }), 1)
})

t('két különböző vevőnek kiállított, azonos összegű kimenő számla nem duplikátum; ugyanannak a vevőnek ugyanaz az összeg egy héten belül gyanús', async () => {
  await db.company.create({ data: { name: 'TESTCO Másik GmbH', vatId: 'DE822222222' } })
  const r = await run([outgoing('D1'), outgoing('D2', { recipient_name: 'TESTCO Másik GmbH', recipient_vat_id: 'DE822222222' })])
  assert.deepEqual(r.results.map((x) => x.status), ['recorded', 'recorded'])
  const same = await run([outgoing('D3')])                                                    // ugyanaz a vevő, azonos összeg, más számlaszám
  assert.equal(same.results[0].status, 'needs_review'); assert.equal(same.results[0].duplicateClass, 'same_event')
})

t('review_first / autoRecord:false: minden az ellenőrzési sorba kerül, semmi nem rögzül', async () => {
  const r = await run([incoming('R1'), outgoing('R2')], { autoRecord: false })
  assert.deepEqual(r.results.map((x) => x.status), ['needs_review', 'needs_review'])
  assert.equal(await db.expense.count({ where: { vendor: { startsWith: 'TESTLIEF' } } }), 0)
})

t('kivétel utólagos javítás + jóváhagyás után ugyanúgy rögzül (közös réteg), és csak egyszer', async () => {
  const r = await run([outgoing('Q1', { net: 200, vat: 0, gross: 210 })])
  assert.equal(r.results[0].status, 'needs_review')
  const id = r.results[0].documentId as string
  assert.ok((await rev.correctDocument(id, { gross: 200 }, 'Laci', db)).ok)
  await orig.attachOriginal({ filename: 'Q1.pdf', bytes: bytes('Q1'), actor: 'Laci' }, { db, store: { put: async (p: string) => p, get: async () => null } })
  const a = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(a.ok && !!a.invoiceId)
  const again = await rev.reviewDocument(id, { action: 'approve' }, 'Laci', db)
  assert.ok(!again.ok && again.code === 'conflict')
  assert.equal(await db.invoice.count({ where: { number: '2026-Q1' } }), 1)
})

// ── A teljes havi csomag, ahogy a ChatGPT hívná (MCP-n át) ─────────────────
async function mcp(name: string, args: unknown, id = 1) {
  process.env.MCP_SECRET = 'teszt-kulcs'
  const { NextRequest } = await import('next/server'); const { POST } = await import('../../app/api/mcp/route')
  const res = await POST(new NextRequest('http://localhost/api/mcp', { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-api-key': 'teszt-kulcs' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) }))
  const j = await res.json(); return { isError: j.result.isError === true, data: JSON.parse(j.result.content[0].text) }
}

t('MCP: havi ZIP egy hívásban — hibátlanok rögzülnek, kivételek jelezve, összegek egyeztethetők; ismétlésre nem szaporodik', async () => {
  const documents = [
    incoming('Z1'), incoming('Z2', { net: 50, vat: 9.5, gross: 59.5 }), incoming('Z3', { gross: 999 }),                  // Z3: összeghiba
    outgoing('Z4'), outgoing('Z5', { net: 1000, vat: 0, gross: 1000, payment_status: 'paid' }), outgoing('Z6', { recipient_name: 'Ismeretlen Bt', recipient_vat_id: undefined }),
    { original_filename: 'kivonat.pdf', sha256: sha('Z7'), kind: 'bank_statement' as const, currency: 'EUR' },            // nem számla: csak tárolva
    { original_filename: 'hibas.pdf', sha256: 'nem-hash', kind: 'other' as const },                                       // hibás bemenet
  ]
  const args = { documents, batch: { filename: 'augusztus.zip', sha256: sha('zip-aug'), total_files: 8, final: true } }
  const first = await mcp('import_financial_batch', args)
  const rep = first.data
  assert.equal(rep.status, 'partial')                                                          // a hibás bemenet miatt nem „success"
  assert.equal(rep.summary.submitted, 8); assert.equal(rep.summary.created, 7); assert.equal(rep.summary.rejected, 1)
  assert.equal(rep.summary.recorded, 6); assert.equal(rep.summary.needs_human_decision, 2)   // emberre csak a Z3 (összeghiba) és a hibás bemenet vár
  const by = Object.fromEntries(rep.results.map((x: { filename: string }) => [x.filename, x]))
  assert.equal(by['Z1.pdf'].recordedAs, 'expense'); assert.equal(by['Z4.pdf'].recordedAs, 'invoice'); assert.equal(by['Z3.pdf'].status, 'needs_review')
  assert.equal(by['kivonat.pdf'].recordedAs, 'document_only')
  assert.deepEqual(rep.recordedTotals['incoming:EUR'], { count: 2, gross: 178.5 })
  assert.deepEqual(rep.recordedTotals['outgoing:EUR'], { count: 3, gross: 1400 })

  const counts = async () => [await db.expense.count({ where: { vendor: { startsWith: 'TESTLIEF' } } }), await db.invoice.count({ where: { notes: { startsWith: 'Importált bizonylat' } } }), await db.financialDocument.count()]
  assert.deepEqual(await counts(), [2, 3, 7])
  const again = (await mcp('import_financial_batch', args, 2)).data
  assert.equal(again.summary.created, 0); assert.equal(again.summary.already_known, 7)
  assert.deepEqual(await counts(), [2, 3, 7])                                                  // semmi nem szaporodott
})

t('MCP: review_first:true — a csomag az ellenőrzési sorba kerül', async () => {
  const r = (await mcp('import_financial_batch', { documents: [incoming('V1')], review_first: true })).data
  assert.equal(r.results[0].status, 'needs_review'); assert.equal(r.summary.recorded, 0)
  assert.equal(await db.expense.count({ where: { vendor: 'TESTLIEF V1' } }), 0)
})
