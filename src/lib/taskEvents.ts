// Feladat-eseménytörténet írása (V1) — append-only napló arról, hogy ki
// (ember / agent / automatizáció) mit változtatott egy feladaton és mi volt előtte.

import { prisma } from './prisma'

// A naplózott Task-mezők — csak az érdemi, döntést hordozó változások.
export const TRACKED_TASK_FIELDS = [
  'title', 'status', 'priority', 'dueDate', 'assigneeId',
  'goalId', 'waitingFor', 'followUpAt', 'description',
] as const

type TaskLike = Record<string, unknown>

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value ?? null
}

export async function logTaskCreated(taskId: string, actor: string) {
  await prisma.taskEvent.create({
    data: { taskId, actor, action: 'created' },
  })
}

export async function logTaskDiff(taskId: string, actor: string, before: TaskLike, after: TaskLike) {
  const events = []
  for (const field of TRACKED_TASK_FIELDS) {
    const b = normalize(before[field])
    const a = normalize(after[field])
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    events.push({
      taskId,
      actor,
      action: field === 'status' ? 'status_changed' : 'updated',
      field,
      before: b as never,
      after: a as never,
    })
  }
  if (events.length > 0) await prisma.taskEvent.createMany({ data: events })
}

export async function logTaskEvent(taskId: string, actor: string, action: string, field?: string, before?: unknown, after?: unknown) {
  await prisma.taskEvent.create({
    data: {
      taskId, actor, action,
      field: field ?? null,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    },
  })
}
