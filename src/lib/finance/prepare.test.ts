import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareDocument, type RawDocInput } from './prepare'
import { decide } from './decide'
import { validateAmounts } from './validate'

const SHA = 'a'.repeat(64)
const base: RawDocInput = { original_filename: 'x.pdf', sha256: SHA, kind: 'incoming_invoice', currency: 'eur', net: 100, vat: 19, gross: 119 }

test('prepare: érvényes bemenet — összegek centre, pénznem nagybetűs, hash kisbetűs', () => {
  const r = prepareDocument({ ...base, sha256: SHA.toUpperCase(), issue_date: '2026-08-10' })
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.doc.netCents, 10000); assert.equal(r.doc.grossCents, 11900)
    assert.equal(r.doc.currency, 'EUR'); assert.equal(r.doc.sha256, SHA)
    assert.equal(r.doc.direction, 'incoming')            // a típusból következik
    assert.equal(r.doc.issueDate?.toISOString().slice(0, 10), '2026-08-10')
  }
})

test('prepare: hibás hash, hiányzó fájlnév, ellentmondó irány → elutasítás', () => {
  assert.equal(prepareDocument({ ...base, sha256: 'abc' }).ok, false)
  assert.equal(prepareDocument({ ...base, original_filename: '  ' }).ok, false)
  const r = prepareDocument({ ...base, direction: 'outgoing' })
  assert.equal(r.ok, false)
})

test('prepare: nem létező vagy hibás formátumú dátum → elutasítás, nem átgörgetés', () => {
  assert.equal(prepareDocument({ ...base, issue_date: '2026-02-31' }).ok, false)
  assert.equal(prepareDocument({ ...base, issue_date: '10.08.2026' }).ok, false)
})

test('prepare: érvénytelen összeg és pénznem → elutasítás', () => {
  assert.equal(prepareDocument({ ...base, net: NaN }).ok, false)
  assert.equal(prepareDocument({ ...base, gross: 99_999_999_999 }).ok, false)
  assert.equal(prepareDocument({ ...base, currency: 'EURO' }).ok, false)
})

test('prepare: hiányzó adat nem találódik ki (null marad)', () => {
  const r = prepareDocument({ original_filename: 'x.pdf', sha256: SHA, kind: 'other' })
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.doc.netCents, null); assert.equal(r.doc.externalNumber, null); assert.equal(r.doc.currency, null) }
})

test('prepare: source_json — érvényes JSON objektumként, érvénytelen nyersen tárolódik', () => {
  const ok = prepareDocument({ ...base, source_json: '{"a":1}' })
  const bad = prepareDocument({ ...base, source_json: 'nem json' })
  assert.ok(ok.ok && bad.ok)
  if (ok.ok && bad.ok) { assert.deepEqual(ok.doc.sourceData, { a: 1 }); assert.deepEqual(bad.doc.sourceData, { raw: 'nem json' }) }
})

test('decide: tesztidőszakban a hibátlan tétel is ellenőrzésre vár', () => {
  const d = decide([], [])
  assert.equal(d.status, 'needs_review'); assert.equal(d.needsHumanDecision, true)
})

test('decide: ha az automatikus rögzítés be van kapcsolva, csak a hibátlan megy át', () => {
  assert.equal(decide([], [], true).status, 'recorded')
  const withIssue = validateAmounts({ currency: 'EUR', netCents: 1, vatCents: 1, grossCents: 5 })
  assert.equal(decide(withIssue, [], true).status, 'needs_review')
  assert.equal(decide([], [{ cls: 'correction', existingId: 'x', reasons: ['r'] }], true).status, 'needs_review')
  assert.equal(decide([], [{ cls: 'same_event', existingId: 'x', reasons: ['r'] }], true).status, 'needs_review')
})

test('decide: biztos duplikátum → duplicate, nincs emberi döntés, hivatkozik az eredetire', () => {
  const d = decide([], [{ cls: 'certain', existingId: 'orig', reasons: ['azonos'] }])
  assert.equal(d.status, 'duplicate'); assert.equal(d.duplicateOfId, 'orig'); assert.equal(d.needsHumanDecision, false)
})
