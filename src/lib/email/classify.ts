// Levél-osztályozás: valódi beszélgetés vs. automatikus zaj vs. spam.
// A cél, hogy a "Válaszra vár" lista CSAK olyat mutasson, amire tényleg
// érdemes válaszolni — ne Amazon/Etsy/hírlevél/no-reply értesítőket.
//
// A döntés a levél fejléceiből + a feladó címéből születik (a rawHeaders
// mezőben tároljuk, így visszamenőleg is osztályozható újralekérés nélkül).

export type EmailCategory = 'conversation' | 'automated' | 'spam'

const NOREPLY_RE =
  /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|noreply|mailer-daemon|postmaster|notification|notifications|bounce|bounces|newsletter|mailer|automated?|auto|marketing|info-noreply)([._+-]|@)/i

export function classifyEmail(
  headers: Record<string, unknown> | null | undefined,
  fromAddress: string | null | undefined,
): EmailCategory {
  const h = (key: string) => String(headers?.[key] ?? '').toLowerCase().trim()

  // 1) Spam — a szerver spam-szűrőjének jelzése (SpamAssassin / Rspamd stb.)
  const spamFlag = h('x-spam-flag')
  const spamStatus = h('x-spam-status')
  if (spamFlag === 'yes' || spamStatus.startsWith('yes')) return 'spam'

  // 2) Automatikus / tömeges — hírlevél, tranzakciós értesítő, no-reply feladó
  const from = (fromAddress ?? '').toLowerCase()
  const precedence = h('precedence')
  const autoSubmitted = h('auto-submitted')
  const hasListHeaders = !!h('list-unsubscribe') || !!h('list-id')
  if (
    hasListHeaders ||
    ['bulk', 'list', 'junk', 'auto_reply'].includes(precedence) ||
    (!!autoSubmitted && autoSubmitted !== 'no') ||
    NOREPLY_RE.test(from)
  ) {
    return 'automated'
  }

  // 3) Minden más: valódi beszélgetés (embertől, válaszra érdemes)
  return 'conversation'
}

// Egy szál összesített kategóriája az egyes leveleiből: ha bármelyik BEJÖVŐ
// levél valódi beszélgetés, a szál is az (volt benne emberi üzenet). Ha egyik
// bejövő sem beszélgetés, akkor spam (ha van), különben automatikus.
export function threadCategory(
  emails: { direction: string; category: string }[],
): EmailCategory {
  const inbound = emails.filter((e) => e.direction === 'inbound')
  if (inbound.length === 0) return 'conversation' // csak mi írtunk
  if (inbound.some((e) => e.category === 'conversation')) return 'conversation'
  if (inbound.some((e) => e.category === 'spam')) return 'spam'
  return 'automated'
}
