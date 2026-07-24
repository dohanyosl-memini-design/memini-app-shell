// A beérkező levél feldolgozott alakja — a bridge `ParsedEmail` típusának
// portja. A tényleges IMAP-lehúzás és mailparser-alapú kinyerés a szinkron-
// réteg feladata lesz (Etap 1 következő szelet), de a típus itt közös.

export interface EmailAddress {
  address: string
  name?: string
}

export interface ParsedAttachment {
  filename: string
  contentType: string
  sizeBytes: number
  contentId: string | null
  isInline: boolean
  content: Buffer
}

export interface ParsedEmail {
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  subject: string
  normalizedSubject: string
  from: EmailAddress | null
  to: EmailAddress[]
  cc: EmailAddress[]
  bcc: EmailAddress[]
  sentAt: Date
  receivedAt: Date
  textBody: string
  htmlBody: string | null
  snippet: string
  headers: Record<string, unknown>
  attachments: ParsedAttachment[]
}

export type EmailDirection = 'inbound' | 'outbound'
