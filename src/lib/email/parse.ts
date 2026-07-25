// Nyers levél → ParsedEmail. A memini-mail-bridge `@memini/email-parser`
// portja (mailparser).
//
// MEGJEGYZÉS a HTML-ről: a htmlBody-t NYERSEN tároljuk. A `sanitize-html`
// csomagot szándékosan NEM használjuk itt, mert az egy csak-ESM htmlparser2-t
// húz, amit a Vercel Node-futásideje require()-rel nem tud betölteni. A
// Levelek fül jelenleg a sima szöveget (textBody) jeleníti meg; amikor a
// HTML-nézetet megépítjük, a sanitizálás ott, megjelenítéskor történik
// (böngészőoldali DOMPurify vagy CJS-kompatibilis sanitizáló).

import { simpleParser, type AddressObject } from 'mailparser'
import { normalizeEmail, normalizeSubject } from './normalize'
import type { EmailAddress, ParsedEmail } from './types'

function addresses(value?: AddressObject | AddressObject[] | null): EmailAddress[] {
  const objects = !value ? [] : Array.isArray(value) ? value : [value]
  return objects.flatMap((item) =>
    item.value
      .filter((entry) => entry.address)
      .map((entry) => ({
        address: normalizeEmail(entry.address!),
        ...(entry.name ? { name: entry.name } : {}),
      })),
  )
}

export async function parseEmail(raw: Buffer | string): Promise<ParsedEmail> {
  const mail = await simpleParser(raw, { skipHtmlToText: false })
  const from = addresses(mail.from)[0] ?? null
  const text = (mail.text ?? '').replace(/\r\n/g, '\n').trim()
  // Nyers HTML — megjelenítés előtt sanitizálni KELL (lásd fenti megjegyzés).
  const html = typeof mail.html === 'string' ? mail.html : null
  const receivedAt = mail.date ?? new Date()
  return {
    messageId: mail.messageId?.trim() ?? null,
    inReplyTo: mail.inReplyTo?.trim() ?? null,
    references: Array.isArray(mail.references)
      ? mail.references.map(String)
      : mail.references
        ? [String(mail.references)]
        : [],
    subject: mail.subject?.trim() || '(Nincs tárgy)',
    normalizedSubject: normalizeSubject(mail.subject ?? ''),
    from,
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    bcc: addresses(mail.bcc),
    sentAt: mail.date ?? receivedAt,
    receivedAt,
    textBody: text,
    htmlBody: html,
    snippet: text.replace(/\s+/g, ' ').slice(0, 240),
    headers: Object.fromEntries(
      Array.from(mail.headers.entries()).map(([key, value]) => [key, String(value).slice(0, 10_000)]),
    ),
    attachments: mail.attachments.map((attachment) => ({
      filename: attachment.filename || 'attachment',
      contentType: attachment.contentType,
      sizeBytes: attachment.size,
      contentId: attachment.cid ?? null,
      isInline: attachment.contentDisposition === 'inline' || Boolean(attachment.cid),
      content: attachment.content,
    })),
  }
}
