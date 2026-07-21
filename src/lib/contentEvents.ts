// Tartalom-eseménytörténet írása (V1) — append-only napló arról, hogy ki
// (ember / agent / automatizáció) mit generált/szerkesztett és mi volt előtte.

import { prisma } from './prisma'

export const TRACKED_PIECE_FIELDS = [
  'title', 'channel', 'status', 'scheduledFor', 'themeId', 'arcId',
  'bodyDe', 'bodyHu', 'bodyEn', 'slug',
] as const

type PieceLike = Record<string, unknown>

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 200) return value.slice(0, 200) + '…'
  return value ?? null
}

export async function logPieceCreated(pieceId: string, actor: string, action = 'created') {
  await prisma.contentEvent.create({ data: { pieceId, actor, action } })
}

export async function logPieceDiff(pieceId: string, actor: string, before: PieceLike, after: PieceLike) {
  const events = []
  for (const field of TRACKED_PIECE_FIELDS) {
    const b = normalize(before[field])
    const a = normalize(after[field])
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    events.push({
      pieceId,
      actor,
      action: field === 'status' ? 'status_changed' : 'updated',
      field,
      before: b as never,
      after: a as never,
    })
  }
  if (events.length > 0) await prisma.contentEvent.createMany({ data: events })
}

export async function logPieceEvent(pieceId: string, actor: string, action: string, field?: string, before?: unknown, after?: unknown) {
  await prisma.contentEvent.create({
    data: {
      pieceId, actor, action,
      field: field ?? null,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    },
  })
}
