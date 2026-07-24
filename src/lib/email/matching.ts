// Levélszál-párosítás és CRM-egyeztetés — a memini-mail-bridge
// `@memini/crm-matching` bevált (és a bridge-ben tesztelt) logikájának hű
// portja. A KÜLÖNBSÉG a bridge-hez képest: a matchCrm most a CRM VALÓDI
// Contact/Company rekordjaira egyeztet, nem egy külön mini-CRM-re.

import { createHash } from 'node:crypto'
import { normalizeEmail, normalizeSubject } from './normalize'
import type { EmailDirection, ParsedEmail } from './types'

export interface ThreadCandidate {
  id: string
  normalizedSubject: string
  participantEmails: string[]
  lastMessageAt: Date
  messageIds: string[]
}

// Bejövő vagy kimenő? Ha a feladó a saját címünk vagy a saját domainünk, akkor
// kimenő. `ownAddresses` a MEMINI_EMAIL_ADDRESSES, `ownDomains` a domainek.
export function determineDirection(
  parsed: ParsedEmail,
  ownAddresses: string[],
  ownDomains: string[],
): EmailDirection {
  const from = parsed.from?.address ?? ''
  const domain = from.split('@')[1] ?? ''
  return ownAddresses.map(normalizeEmail).includes(from) ||
    ownDomains.map((value) => value.toLowerCase()).includes(domain)
    ? 'outbound'
    : 'inbound'
}

// Melyik meglévő szálhoz tartozik a levél?
//   1) elsődlegesen Message-ID / In-Reply-To / References lánc alapján;
//   2) ha az nincs, tárgy-egyezés + legalább 2 közös résztvevő + 14 napos
//      időablak heurisztikával. Ha egyik sem, null → új szál.
export function chooseThread(parsed: ParsedEmail, candidates: ThreadCandidate[]): string | null {
  const referenceIds = new Set([parsed.inReplyTo, ...parsed.references].filter(Boolean))
  const referenceMatch = candidates.find((candidate) =>
    candidate.messageIds.some((id) => referenceIds.has(id)),
  )
  if (referenceMatch) return referenceMatch.id

  const participants = new Set(
    [parsed.from, ...parsed.to, ...parsed.cc].filter(Boolean).map((item) => item!.address),
  )
  const maxDistance = 14 * 24 * 60 * 60 * 1000
  const fallback = candidates.find((candidate) => {
    if (candidate.normalizedSubject !== parsed.normalizedSubject || !parsed.normalizedSubject)
      return false
    const overlap = candidate.participantEmails.filter((email) => participants.has(email)).length
    const close =
      Math.abs(parsed.sentAt.getTime() - candidate.lastMessageAt.getTime()) <= maxDistance
    return overlap >= 2 && close
  })
  return fallback?.id ?? null
}

// Stabil ujjlenyomat deduplikáláshoz, ha nincs Message-ID.
export function fallbackEmailHash(parsed: ParsedEmail): string {
  const participants = [...parsed.to, ...parsed.cc]
    .map((item) => item.address)
    .sort()
    .join(',')
  const body = createHash('sha256').update(parsed.textBody).digest('hex')
  return createHash('sha256')
    .update(
      [
        parsed.from?.address ?? '',
        participants,
        normalizeSubject(parsed.subject),
        parsed.sentAt.toISOString(),
        body,
      ].join('|'),
    )
    .digest('hex')
}

export interface ContactRecord {
  id: string
  companyId: string | null
  emailAddresses: string[]
}
export interface CompanyRecord {
  id: string
  domain: string | null
}

// Egy e-mail-címet a CRM partneréhez köt: előbb pontos kontakt-egyezés, majd
// cégdomain-egyezés (utóbbi csak javaslat — suggestedCompanyId).
export function matchCrm(
  email: string,
  contacts: ContactRecord[],
  companies: CompanyRecord[],
): { contactId: string | null; companyId: string | null; suggestedCompanyId: string | null } {
  const normalized = normalizeEmail(email)
  const contact = contacts.find((entry) =>
    entry.emailAddresses.map(normalizeEmail).includes(normalized),
  )
  if (contact) {
    return { contactId: contact.id, companyId: contact.companyId, suggestedCompanyId: null }
  }
  const domain = normalized.split('@')[1] ?? ''
  const company = domain
    ? companies.find((entry) => entry.domain && entry.domain.toLowerCase() === domain)
    : undefined
  return {
    contactId: null,
    companyId: null,
    suggestedCompanyId: company?.id ?? null,
  }
}
