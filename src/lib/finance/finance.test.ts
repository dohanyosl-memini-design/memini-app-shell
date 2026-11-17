import test from 'node:test'
import assert from 'node:assert/strict'
import { toCents, fromCents, sameAmount } from './money'
import { validateAmounts, statusFromIssues } from './validate'
import { classifyDuplicate, findDuplicates, normalizeNumber, type Fingerprint } from './dedupe'

// ─── pénz ────────────────────────────────────────────────────────────────
test('toCents: lebegőpontos zaj nélkül kerekít', () => {
  assert.equal(toCents(1097.18), 109718)
  assert.equal(toCents(0.1 + 0.2), 30)          // 0.30000000000000004
  assert.equal(toCents(1.005), 101)             // 1.005*100 = 100.49999999999999
  assert.equal(toCents(19.99), 1999)
  assert.equal(toCents(0), 0)
})

test('toCents: negatívnál is szimmetrikus (félre kifelé)', () => {
  assert.equal(toCents(-1.005), -101)
  assert.equal(toCents(-1097.18), -109718)
})

test('toCents: nem véges számot elutasít', () => {
  assert.throws(() => toCents(NaN))
  assert.throws(() => toCents(Infinity))
})

test('fromCents / sameAmount: régi Float és új cent összevetése', () => {
  assert.equal(fromCents(109718), 1097.18)
  assert.equal(sameAmount(1097.1800000000001, 1097.18), true)
  assert.equal(sameAmount(1097.19, 1097.18), false)
})

// ─── összeg-ellenőrzés ───────────────────────────────────────────────────
const ok = { kind: 'incoming_invoice', currency: 'EUR', netCents: 10000, vatCents: 1900, grossCents: 11900 }

test('validate: rendben lévő 19%-os számla nem kap jelzést', () => {
  assert.deepEqual(validateAmounts(ok), [])
  assert.equal(statusFromIssues([]), 'recorded')
})

test('validate: nettó + ÁFA ≠ bruttó → error', () => {
  const issues = validateAmounts({ ...ok, grossCents: 11901 })
  assert.ok(issues.some((i) => i.code === 'SUM_MISMATCH' && i.severity === 'error'))
  assert.equal(statusFromIssues(issues), 'needs_review')
})

test('validate: hiányzó pénznem → error', () => {
  assert.ok(validateAmounts({ ...ok, currency: null }).some((i) => i.code === 'CURRENCY_MISSING'))
})

test('validate: nincs összeg → error, és nem pótol', () => {
  const issues = validateAmounts({ currency: 'EUR' })
  assert.deepEqual(issues.map((i) => i.code), ['AMOUNTS_MISSING'])
})

test('validate: hiányos összegek (csak bruttó) → figyelmeztetés, nincs kitalálás', () => {
  const issues = validateAmounts({ currency: 'EUR', grossCents: 11900 })
  assert.ok(issues.some((i) => i.code === 'AMOUNT_INCOMPLETE'))
})

test('validate: eltérő ÁFA-kulcsok — 7% és 19% ismert, a 12,5% szokatlan', () => {
  assert.deepEqual(validateAmounts({ ...ok, netCents: 10000, vatCents: 700, grossCents: 10700 }), [])
  const odd = validateAmounts({ ...ok, netCents: 10000, vatCents: 1250, grossCents: 11250 })
  assert.ok(odd.some((i) => i.code === 'UNUSUAL_VAT_RATE'))
})

test('validate: külföldi/adómentes (0 ÁFA) ellenőrzésre vár, nem automatikus', () => {
  const issues = validateAmounts({ ...ok, vatCents: 0, grossCents: 10000 })
  assert.ok(issues.some((i) => i.code === 'ZERO_VAT' && i.severity === 'warning'))
  assert.equal(statusFromIssues(issues), 'needs_review')
})

test('validate: jóváírás/sztornó negatív; pozitív esetén jelzés', () => {
  const neg = { kind: 'credit_note', currency: 'EUR', netCents: -10000, vatCents: -1900, grossCents: -11900 }
  assert.deepEqual(validateAmounts(neg), [])
  const pos = validateAmounts({ ...neg, netCents: 10000, vatCents: 1900, grossCents: 11900 })
  assert.ok(pos.some((i) => i.code === 'SIGN_UNEXPECTED'))
  // negatív összeg sima számlán is jelzés
  assert.ok(validateAmounts({ ...ok, netCents: -10000, vatCents: -1900, grossCents: -11900 })
    .some((i) => i.code === 'SIGN_UNEXPECTED'))
})

test('validate: soronkénti összeg nem egyezik a végösszeggel → error', () => {
  const issues = validateAmounts({ ...ok, lineNetCents: [6000, 3000] })
  assert.ok(issues.some((i) => i.code === 'LINE_SUM_MISMATCH'))
  assert.deepEqual(validateAmounts({ ...ok, lineNetCents: [6000, 4000] }), [])
})

// ─── duplikáció ──────────────────────────────────────────────────────────
const existing: Fingerprint = {
  id: 'a1', sha256: 'aaa', kind: 'incoming_invoice', externalNumber: 'RE-2026/0012',
  issuerVatId: 'DE 123 456 789', issuerName: 'Druck GmbH', issueDate: '2026-08-10',
  grossCents: 11900, currency: 'EUR',
}

test('dedupe: számlaszám-normalizálás', () => {
  assert.equal(normalizeNumber('RE-2026/0012'), 'RE20260012')
  assert.equal(normalizeNumber('re 2026 0012'), 'RE20260012')
  assert.equal(normalizeNumber(null), '')
})

test('dedupe: azonos fájl (hash) → certain', () => {
  assert.equal(classifyDuplicate({ sha256: 'aaa' }, [existing]), 'certain')
})

test('dedupe: ugyanaz a ZIP újra → minden dokumentum certain (idempotens)', () => {
  const second = [{ sha256: 'aaa' }, { sha256: 'bbb' }]
  const known: Fingerprint[] = [{ id: '1', sha256: 'aaa' }, { id: '2', sha256: 'bbb' }]
  assert.deepEqual(second.map((d) => classifyDuplicate(d, known)), ['certain', 'certain'])
})

test('dedupe: adószám + számlaszám + összeg egyezik (más fájl) → certain', () => {
  const c: Fingerprint = { ...existing, id: undefined, sha256: 'zzz', externalNumber: 're 2026/0012', issuerVatId: 'DE123456789' }
  assert.equal(classifyDuplicate(c, [existing]), 'certain')
})

test('dedupe: csak névalapú egyezés (nincs adószám) → probable, nem certain', () => {
  const noVat = { ...existing, issuerVatId: null }
  const c: Fingerprint = { ...noVat, id: undefined, sha256: 'zzz', issuerName: 'DRUCK gmbh' }
  assert.equal(classifyDuplicate(c, [noVat]), 'probable')
})

test('dedupe: ugyanaz a szám, de eltérő összeg → probable (újrakiállítás lehet)', () => {
  const c: Fingerprint = { ...existing, id: undefined, sha256: 'zzz', grossCents: 12000 }
  const m = findDuplicates(c, [existing])[0]
  assert.equal(m.cls, 'probable')
  assert.ok(m.reasons.some((r) => r.includes('eltér')))
})

test('dedupe: eltérő számlaszám, de azonos gazdasági esemény → same_event', () => {
  const c: Fingerprint = { ...existing, id: undefined, sha256: 'zzz', externalNumber: 'INV-77', issueDate: '2026-08-12' }
  assert.equal(classifyDuplicate(c, [existing]), 'same_event')
})

test('dedupe: eltérő szám és távoli dátum → distinct (külön számla)', () => {
  const c: Fingerprint = { ...existing, id: undefined, sha256: 'zzz', externalNumber: 'RE-2026/0099', issueDate: '2026-09-30' }
  assert.equal(classifyDuplicate(c, [existing]), 'distinct')
})

test('dedupe: más kibocsátó azonos összeggel → distinct', () => {
  const c: Fingerprint = { ...existing, id: undefined, sha256: 'zzz', issuerVatId: 'DE999999999', issuerName: 'Más Kft', externalNumber: 'X1' }
  assert.equal(classifyDuplicate(c, [existing]), 'distinct')
})

test('dedupe: sztornó az eredeti számlára hivatkozva → correction, nem duplikátum', () => {
  const storno: Fingerprint = {
    sha256: 'sss', kind: 'storno', externalNumber: 'ST-1', relatedNumber: 'RE 2026/0012',
    issuerVatId: existing.issuerVatId, grossCents: -11900, currency: 'EUR',
  }
  const m = findDuplicates(storno, [existing])[0]
  assert.equal(m.cls, 'correction')
  assert.equal(m.existingId, 'a1')
})

test('dedupe: a legerősebb találat elöl áll', () => {
  const sameEvent: Fingerprint = { ...existing, id: 'b2', sha256: 'bbb', externalNumber: 'INV-77', issueDate: '2026-08-11' }
  const c: Fingerprint = { sha256: 'aaa', ...existing, id: undefined }
  const res = findDuplicates(c, [sameEvent, existing])
  assert.equal(res[0].cls, 'certain')
})
