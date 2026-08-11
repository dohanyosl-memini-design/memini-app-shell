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
  // ── Piszkozat (Arthur írja MCP-n, a szerkesztőben kontrollálod) ──
  /** Tárgy. */
  subject?: string | null
  /** A küldendő levél a cég nyelvén (DE/EN). */
  body?: string | null
  /** Magyar kontroll-fordítás — hogy lásd, mit mondasz valójában. */
  bodyHu?: string | null
  /** Mikor frissült utoljára a piszkozat (ISO). */
  draftUpdatedAt?: string | null
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

// A base budapesti naptári napja + `days` nap, YYYY-MM-DD alakban. Déli UTC-
// horgonyt használ, hogy a nyári/téli időszámítás váltása se csússzon el.
function addDays(base: Date, days: number): string {
  const bpDay = base.toLocaleDateString('en-CA', { timeZone: 'Europe/Budapest' }) // YYYY-MM-DD
  const [y, m, d] = bpDay.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  anchor.setUTCDate(anchor.getUTCDate() + days)
  return anchor.toISOString().slice(0, 10)
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
    const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
    clean.push({
      id: o.id,
      label: o.label,
      dueAt: typeof o.dueAt === 'string' ? o.dueAt : null,
      sentAt: typeof o.sentAt === 'string' ? o.sentAt : null,
      skipped: o.skipped === true ? true : undefined,
      subject: str(o.subject),
      body: str(o.body),
      bodyHu: str(o.bodyHu),
      draftUpdatedAt: str(o.draftUpdatedAt),
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

// A következő kiküldendő lépés (első, ami még nem ment ki és nincs kihagyva).
// Ez mutatja, „melyik levélnél tart" a lead. null, ha nincs sorozat vagy kész.
export function nextStep(seq: EmailSequence | null): SequenceStep | null {
  if (!seq) return null
  return seq.steps.find((s) => !s.sentAt && !s.skipped) ?? null
}
