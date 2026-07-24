// Közös típusok a Levelek fül és a partner-oldali beágyazás között.

export interface ThreadListItem {
  id: string
  subject: string
  replyStatus: string
  lastMessageAt: string
  messageCount: number
  snippet: string
  lastDirection: string | null
  company: { id: string; name: string } | null
  contact: { id: string; name: string } | null
  hasAgentDraft: boolean
  draftCount: number
}

export interface ThreadListResponse {
  threads: ThreadListItem[]
  unansweredCount: number
}

export interface EmailParticipant {
  type: string
  emailAddress: string
  displayName: string | null
}

export interface EmailMessage {
  id: string
  subject: string
  direction: string
  textBody: string
  htmlBody: string | null
  snippet: string
  sentAt: string
  receivedAt: string
  participants: EmailParticipant[]
  attachments: { id: string; filename: string; contentType: string }[]
}

export interface EmailDraft {
  id: string
  subject: string
  bodyText: string
  status: string
  source: string
  createdAt: string
  sendError: string | null
}

export interface ThreadDetail {
  id: string
  subject: string
  replyStatus: string
  firstMessageAt: string
  lastMessageAt: string
  messageCount: number
  company: { id: string; name: string; city: string | null; partnerType: string | null; classification: string | null } | null
  contact: { id: string; name: string; email: string | null } | null
  emails: EmailMessage[]
  drafts: EmailDraft[]
}

// Válaszstátusz → magyar címke + szín-osztály (Tailwind).
export const REPLY_STATUS: Record<string, { label: string; cls: string }> = {
  unanswered: { label: 'Válaszra vár', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  answered: { label: 'Válaszolt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  reply_later: { label: 'Később', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  no_reply_needed: { label: 'Nem kell válasz', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  closed: { label: 'Lezárva', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('hu-HU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
