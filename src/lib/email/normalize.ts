// E-mail-normalizálás — a memini-mail-bridge `@memini/shared` helpereinek
// hű portja. Tartalom nem változott; csak a CRM-be költözött.

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

// Levéltárgy normalizálása: a válasz/továbbítás-prefixek (Re:, Fwd:, AW:, WG:,
// SV: …) többszörös rétegét is lehántja, hogy a szál-párosítás egy tárgyat lásson.
export function normalizeSubject(value: string): string {
  let result = value.trim()
  const prefix = /^(?:(?:re|fw|fwd|aw|wg|sv)\s*:\s*)/i
  while (prefix.test(result)) result = result.replace(prefix, '').trim()
  return result.replace(/\s+/g, ' ').toLowerCase()
}
