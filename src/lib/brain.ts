import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/** Memini Brain — a négy tudástípus és a hozzájuk tartozó életciklus. */
export const BRAIN_KINDS = ['decision', 'learning', 'idea', 'open_loop'] as const
export type BrainKind = (typeof BRAIN_KINDS)[number]

export const BRAIN_KIND_LABEL: Record<BrainKind, string> = {
  decision:  'Döntés',
  learning:  'Tanulság',
  idea:      'Ötlet',
  open_loop: 'Nyitott ügy',
}

export const BRAIN_KIND_ICON: Record<BrainKind, string> = {
  decision:  '⚖️',
  learning:  '🎓',
  idea:      '💡',
  open_loop: '🔗',
}

/** Típusonként más az életciklus — a döntés nem "lezárul", hanem felülíródik. */
export const BRAIN_STATUSES: Record<BrainKind, string[]> = {
  decision:  ['active', 'superseded', 'reverted'],
  learning:  ['active', 'archived'],
  idea:      ['new', 'exploring', 'accepted', 'rejected', 'parked'],
  open_loop: ['open', 'closed'],
}

export const BRAIN_DEFAULT_STATUS: Record<BrainKind, string> = {
  decision:  'active',
  learning:  'active',
  idea:      'new',
  open_loop: 'open',
}

export const BRAIN_STATUS_LABEL: Record<string, string> = {
  active:     'érvényben',
  superseded: 'felülírva',
  reverted:   'visszavonva',
  archived:   'archivált',
  new:        'új',
  exploring:  'vizsgálat alatt',
  accepted:   'elfogadva',
  rejected:   'elvetve',
  parked:     'későbbre téve',
  open:       'nyitott',
  closed:     'lezárva',
}

export interface BrainNoteInput {
  kind: BrainKind
  title: string
  content: string
  details?: Record<string, unknown>
  status?: string
  importance?: number
  companyId?: string
  contactId?: string
  dealId?: string
  orderId?: string
  taskId?: string
  source?: string
  confidence?: string
  eventDate?: string
  dueDate?: string
}

/** Az üres/undefined mezőket kiszűrve ír; a details-ből is kidobja az üreseket. */
export async function createBrainNote(input: BrainNoteInput) {
  const details = Object.fromEntries(
    Object.entries(input.details ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Prisma.InputJsonObject
  return prisma.brainNote.create({
    data: {
      kind:       input.kind,
      title:      input.title,
      content:    input.content,
      details,
      status:     input.status ?? BRAIN_DEFAULT_STATUS[input.kind],
      importance: input.importance ?? 2,
      companyId:  input.companyId || null,
      contactId:  input.contactId || null,
      dealId:     input.dealId    || null,
      orderId:    input.orderId   || null,
      taskId:     input.taskId    || null,
      source:     input.source     ?? 'mcp',
      confidence: input.confidence ?? 'certain',
      eventDate:  input.eventDate ? new Date(input.eventDate) : new Date(),
      dueDate:    input.dueDate   ? new Date(input.dueDate)   : null,
    },
    include: { company: { select: { name: true } } },
  })
}

/** Rövid, ember által olvasható visszajelzés MCP tool-oknak. */
export function describeBrainNote(note: {
  kind: string
  title: string
  status: string
  id: string
  company?: { name: string } | null
}) {
  const kind = BRAIN_KIND_LABEL[note.kind as BrainKind] ?? note.kind
  const icon = BRAIN_KIND_ICON[note.kind as BrainKind] ?? '•'
  const status = BRAIN_STATUS_LABEL[note.status] ?? note.status
  const who = note.company?.name ? ` — ${note.company.name}` : ''
  return `${icon} ${kind} rögzítve${who}: ${note.title} (${status}) — ID: ${note.id}`
}
