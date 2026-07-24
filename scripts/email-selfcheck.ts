// Könnyű önellenőrzés a levelező-logika portjához (a CRM-repóban nincs
// teszt-futtató). A memini-mail-bridge crm-matching tesztjeinek szellemében,
// node:assert-tel. Futtatás: npx tsx scripts/email-selfcheck.ts

import assert from 'node:assert/strict'
import {
  chooseThread, determineDirection, matchCrm, fallbackEmailHash,
  type ThreadCandidate,
} from '../src/lib/email/matching'
import { normalizeSubject, normalizeEmail } from '../src/lib/email/normalize'
import type { ParsedEmail } from '../src/lib/email/types'

const email = (overrides: Partial<ParsedEmail> = {}): ParsedEmail => ({
  messageId: '<new>', inReplyTo: null, references: [],
  subject: 'Re: Ajánlat', normalizedSubject: 'ajánlat',
  from: { address: 'partner@example.com' }, to: [{ address: 'hello@memini.example' }],
  cc: [], bcc: [],
  sentAt: new Date('2026-07-14'), receivedAt: new Date('2026-07-14'),
  textBody: 'Hello', htmlBody: null, snippet: 'Hello', headers: {}, attachments: [],
  ...overrides,
})

const candidate: ThreadCandidate = {
  id: 'thread-1', normalizedSubject: 'ajánlat',
  participantEmails: ['partner@example.com', 'hello@memini.example'],
  lastMessageAt: new Date('2026-07-10'), messageIds: ['<original>'],
}

let n = 0
const check = (name: string, fn: () => void) => { fn(); n++; console.log('  ✓', name) }

console.log('Levelező-logika önellenőrzés:')

check('References > heurisztika', () =>
  assert.equal(chooseThread(email({ references: ['<original>'] }), [candidate]), 'thread-1'))
check('tárgy + 2 résztvevő + időközelség fallback', () =>
  assert.equal(chooseThread(email(), [candidate]), 'thread-1'))
check('régi beszélgetést nem von össze csak tárgy alapján', () =>
  assert.equal(chooseThread(email({ sentAt: new Date('2025-01-01') }), [candidate]), null))
check('pontos kontakt-egyezés (kis/nagybetűtől függetlenül)', () =>
  assert.deepEqual(
    matchCrm('MARA@EXAMPLE.COM', [{ id: 'c1', companyId: 'co1', emailAddresses: ['mara@example.com'] }], []),
    { contactId: 'c1', companyId: 'co1', suggestedCompanyId: null }))
check('egyértelmű domain-egyezés csak javaslat', () =>
  assert.equal(
    matchCrm('new@example.com', [], [{ id: 'co1', domain: 'example.com' }]).suggestedCompanyId, 'co1'))
check('nincs domain-egyezés → nincs javaslat', () =>
  assert.equal(matchCrm('x@unknown.com', [], [{ id: 'co1', domain: 'example.com' }]).suggestedCompanyId, null))
check('saját domainről kimenő irány', () =>
  assert.equal(determineDirection(email({ from: { address: 'team@memini.example' } }), [], ['memini.example']), 'outbound'))
check('idegen feladó → bejövő', () =>
  assert.equal(determineDirection(email(), ['hello@memini.example'], ['memini.example']), 'inbound'))
check('normalizeSubject lehántja a több prefixet', () =>
  assert.equal(normalizeSubject('Re: AW:  Wg: Angebot'), 'angebot'))
check('normalizeEmail trim + lowercase', () =>
  assert.equal(normalizeEmail('  Foo@Bar.DE '), 'foo@bar.de'))
check('fallbackEmailHash determinisztikus', () =>
  assert.equal(fallbackEmailHash(email()), fallbackEmailHash(email())))
check('fallbackEmailHash különböző testre eltér', () =>
  assert.notEqual(fallbackEmailHash(email()), fallbackEmailHash(email({ textBody: 'Más' }))))

console.log(`\n${n} ellenőrzés rendben ✅`)
