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
  // ── Sablonból örökölt útmutató (a sablonból másolódik, az ügynököt vezeti) ──
  /** "Miről szóljon" — útmutató az ügynöknek. */
  brief?: string | null
  /** Sablon levélminta, amit az ügynök személyre szab. */
  sampleBody?: string | null
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

// Egy sablon-lépés definíciója (a központi sablon eleme).
export interface TemplateStepDef {
  label: string
  offsetDays: number
  subject?: string | null
  brief?: string | null
  sampleBody?: string | null
}

// Beépített ALAP sablon — ezzel töltődik fel a központi sablon-tábla, amíg a
// felhasználó a beállításokban át nem írja. A brief magyarul szól az ügynökhöz,
// a sample a küldendő nyelv (DE) kiinduló mintája, amit az ügynök személyre szab.
export const DEFAULT_TEMPLATE_STEPS: TemplateStepDef[] = [
  {
    label: 'Üdvözlő', offsetDays: 0,
    subject: 'Willkommen bei Memini',
    brief: 'Köszönjük a feliratkozást. Röviden: kik vagyunk (egyedi souvenir / hűtőmágnes gyártó múzeumoknak, váraknak, boltoknak), és mit várhat a következő napokban. Meleg, rövid, nem tolakodó.',
    sampleBody: 'Sehr geehrte/r [Anrede] [Nachname],\n\nvielen Dank für Ihr Interesse an Memini. Wir gestalten individuelle Souvenirs für Museen, Burgen und Geschenkläden. In den nächsten Tagen stellen wir uns kurz vor und zeigen, wie wir für [Ort] arbeiten könnten.\n\nHerzliche Grüße',
  },
  {
    label: 'Bemutatkozó', offsetDays: 3,
    subject: 'Individuelle Souvenirs für [Ort]',
    brief: 'Kik vagyunk bővebben, 1-2 referencia, miért érdemes velünk dolgozni. A helyszínre (múzeum/vár/bolt) szabva. Konkrét, de rövid.',
    sampleBody: 'Sehr geehrte/r [Anrede] [Nachname],\n\nMemini entwirft und produziert individuelle Souvenirs – von Kühlschrankmagneten bis zu besonderen Geschenkartikeln. Für Häuser wie [Ort] gestalten wir Motive, die zu Ihrem Ort passen.\n\nGerne zeigen wir Ihnen Beispiele.\n\nHerzliche Grüße',
  },
  {
    label: 'Minta-ajánlat', offsetDays: 7,
    subject: '3 kostenlose Musterentwürfe für [Ort]',
    brief: 'Ajánljuk fel a 3 egyedi, ingyenes mintatervet a helyszínhez. Ez a fő konverziós lépés — világos felhívás a cselekvésre.',
    sampleBody: 'Sehr geehrte/r [Anrede] [Nachname],\n\ngerne erstellen wir für [Ort] drei individuelle Musterentwürfe – kostenlos und unverbindlich. Sagen Sie uns einfach, welche Motive oder Themen für Sie interessant sind.\n\nHerzliche Grüße',
  },
  {
    label: 'Emlékeztető', offsetDays: 14,
    subject: 'Kurze Erinnerung – Ihre Musterentwürfe',
    brief: 'Finom emlékeztető, ha nem jött válasz. Nem nyomulós, csak felajánljuk újra a segítséget / a mintákat.',
    sampleBody: 'Sehr geehrte/r [Anrede] [Nachname],\n\nich wollte mich kurz melden – falls unser Angebot für individuelle Musterentwürfe für [Ort] interessant ist, bin ich gerne für Sie da.\n\nHerzliche Grüße',
  },
]

export function stepId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// A base budapesti naptári napja + `days` nap, YYYY-MM-DD alakban. Déli UTC-
// horgonyt használ, hogy a nyári/téli időszámítás váltása se csússzon el.
export function addDays(base: Date, days: number): string {
  const bpDay = base.toLocaleDateString('en-CA', { timeZone: 'Europe/Budapest' }) // YYYY-MM-DD
  const [y, m, d] = bpDay.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  anchor.setUTCDate(anchor.getUTCDate() + days)
  return anchor.toISOString().slice(0, 10)
}

// Sablon-definíciókból friss sorozatot állít elő (tiszta függvény, prisma nélkül).
// A brief + minta + tárgy VELE UTAZIK a leadhez, hogy az ügynök lássa, mit írjon.
export function stepsFromTemplate(defs: TemplateStepDef[], from: Date = new Date()): EmailSequence {
  return {
    steps: defs.map((t) => ({
      id: stepId(),
      label: t.label,
      dueAt: addDays(from, t.offsetDays),
      sentAt: null,
      subject: t.subject ?? null,
      brief: t.brief ?? null,
      sampleBody: t.sampleBody ?? null,
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
      brief: str(o.brief),
      sampleBody: str(o.sampleBody),
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
