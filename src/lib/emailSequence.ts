// Kézi email-sorozat egy meleg leadhez. NEM automatikus küldés — csak követés:
// mi ment ki, mi van még hátra. A lépések a cégen (Company.emailSequence JSON)
// élnek. Meleg leaddé váláskor a sablonból töltődik fel, de leadenként szabadon
// szerkeszthető (fix sablon, de módosítható).

export interface SequenceStep {
  id: string
  label: string
  /** Esedékesség (YYYY-MM-DD). A küldés kézi, ez csak emlékeztető. */
  dueAt: string | null
  /** Mikor ment ki ténylegesen (ISO). null = még nem. */
  sentAt: string | null
  /** Kihagyott lépés (nem küldjük, de a listában marad átláthatóságért). */
  skipped?: boolean
}

export interface EmailSequence {
  steps: SequenceStep[]
}

// Alap sablon: cím + hány nappal a sorozat indulása után esedékes.
// Leadenként módosítható; itt csak a kiinduló lépéssor van.
export const SEQUENCE_TEMPLATE: { label: string; offsetDays: number }[] = [
  { label: 'Üdvözlő — köszönjük a feliratkozást', offsetDays: 0 },
  { label: 'Bemutatkozó — kik vagyunk, referenciák', offsetDays: 3 },
  { label: 'Minta-ajánlat — kérd a 3 egyedi mintát', offsetDays: 7 },
  { label: 'Emlékeztető — ha nem jött válasz', offsetDays: 14 },
]

function stepId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// A sablonból friss sorozatot állít elő, a mai naptól számított esedékességekkel.
export function buildSequenceFromTemplate(from: Date = new Date()): EmailSequence {
  return {
    steps: SEQUENCE_TEMPLATE.map((t) => ({
      id: stepId(),
      label: t.label,
      dueAt: addDays(from, t.offsetDays),
      sentAt: null,
    })),
  }
}

// Egy tetszőleges JSON-értékből biztonságos EmailSequence-t olvas (védekezik a
// hibás/hiányzó adat ellen).
export function parseSequence(value: unknown): EmailSequence | null {
  if (!value || typeof value !== 'object') return null
  const steps = (value as { steps?: unknown }).steps
  if (!Array.isArray(steps)) return null
  const clean: SequenceStep[] = []
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    clean.push({
      id: o.id,
      label: o.label,
      dueAt: typeof o.dueAt === 'string' ? o.dueAt : null,
      sentAt: typeof o.sentAt === 'string' ? o.sentAt : null,
      skipped: o.skipped === true ? true : undefined,
    })
  }
  return { steps: clean }
}

// Rövid összegzés a kártyára: hány ment ki az aktív (nem kihagyott) lépésből.
export function sequenceProgress(seq: EmailSequence | null): { sent: number; total: number } | null {
  if (!seq) return null
  const active = seq.steps.filter((s) => !s.skipped)
  if (active.length === 0) return null
  return { sent: active.filter((s) => s.sentAt).length, total: active.length }
}
