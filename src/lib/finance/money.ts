/**
 * Pénz egész centben. Az új pénzügyi táblák minden összege cent (Int); a régi
 * Float mezőkhöz csak itt, EGY helyen kerekítünk, hogy ne legyen kétféle szabály.
 */

/** Tizedes összeg → cent, „félre felfelé" (abszolút értékben), lebegőpontos zaj nélkül. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error(`Érvénytelen összeg: ${amount}`)
  const sign = amount < 0 ? -1 : 1
  // A toPrecision(15) kitisztítja a bináris zajt (1.005*100 = 100.49999999999999),
  // így az 1,005 tizedes szabály szerint 101 centre kerekedik, nem 100-ra.
  const cents = Math.round(parseFloat((Math.abs(amount) * 100).toPrecision(15)))
  return sign * cents
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** Két összeg egyezése centre kerekítve — régi Float és új cent összevetéséhez. */
export function sameAmount(a: number, b: number): boolean {
  return toCents(a) === toCents(b)
}
