/**
 * A napló napjai HELYI idő szerint értendők — a szerver UTC-ben fut, ezért a
 * nap határait külön ki kell számolni. Enélkül az éjfél körüli események
 * (jellemzően levelek) a rossz naphoz kerülnének.
 */

export const TZ = 'Europe/Budapest'

/** Egy adott pillanat helyi napja, YYYY-MM-DD alakban. */
export function localDay(at: Date = new Date()): string {
  // Az en-CA formátum eleve YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(at)
}

/** A zóna eltolása UTC-hez képest az adott pillanatban, ezredmásodpercben. */
function offsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const p = Object.fromEntries(parts.map(x => [x.type, x.value])) as Record<string, string>
  // A formázó nem ad ezredmásodpercet, az eltolás viszont mindig egész perc —
  // ezért az eredeti ms-t vissza kell tenni, különben a nap határa elcsúszik.
  const asIfUtc = Date.UTC(
    +p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second, at.getUTCMilliseconds()
  )
  return asIfUtc - at.getTime()
}

/** Egy helyi nap kezdete és vége UTC pillanatként. */
export function localDayBounds(day: string): { start: Date; end: Date } {
  const naiveStart = new Date(`${day}T00:00:00.000Z`)
  const start = new Date(naiveStart.getTime() - offsetMs(naiveStart))
  const naiveEnd = new Date(`${day}T23:59:59.999Z`)
  const end = new Date(naiveEnd.getTime() - offsetMs(naiveEnd))
  return { start, end }
}

/**
 * A DailyJournal.date oszlop dátum típusú — mindig UTC-éjfélként tároljuk,
 * hogy a visszaolvasás ugyanazt a YYYY-MM-DD-t adja vissza.
 */
export function dayToDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

export function dbDateToDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Egyszerű YYYY-MM-DD ellenőrzés a tool-bemenetekhez. */
export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`))
}
