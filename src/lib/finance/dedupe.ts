/**
 * Duplikáció-osztályozás. Nem összevon, csak megmondja, mi az összefüggés — a
 * bizonytalan esetet ember dönti el. A vizsgálat nem csak a számlaszámra épül.
 */

export type DuplicateClass = 'certain' | 'probable' | 'same_event' | 'correction' | 'distinct'

export interface Fingerprint {
  id?: string
  sha256?: string | null
  kind?: string | null
  externalNumber?: string | null
  relatedNumber?: string | null
  issuerVatId?: string | null
  issuerName?: string | null
  issueDate?: Date | string | null
  grossCents?: number | null
  currency?: string | null
}

export interface DuplicateMatch {
  cls: Exclude<DuplicateClass, 'distinct'>
  existingId?: string
  reasons: string[]
}

const CORRECTION_KINDS = new Set(['storno', 'credit_note', 'correction'])
const SAME_EVENT_WINDOW_DAYS = 7
// Rangsor: ami előbb áll, az erősebb találat.
const RANK: Record<DuplicateMatch['cls'], number> = { certain: 0, correction: 1, probable: 2, same_event: 3 }

/** Számlaszám összehasonlításhoz: kisbetű nélküli, írásjel és szóköz nélküli. */
export function normalizeNumber(n?: string | null): string {
  return (n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeVatId(v?: string | null): string {
  return (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const LEGAL_SUFFIX = /\b(gmbh|ug|ag|kg|ohg|gbr|e\.?k\.?|kft|zrt|bt|nyrt|ltd|llc|inc|s\.?r\.?l|co)\b/g
export function normalizeName(n?: string | null): string {
  return (n ?? '').toLowerCase().replace(LEGAL_SUFFIX, '').replace(/[^a-z0-9áéíóöőúüű]/g, '')
}

function toDay(d?: Date | string | null): number | null {
  if (!d) return null
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? null : Math.floor(t / 86_400_000)
}

/** Ugyanaz a kibocsátó? Az adószám erősebb jel, mint a név. */
function sameIssuer(a: Fingerprint, b: Fingerprint): 'vat' | 'name' | null {
  const va = normalizeVatId(a.issuerVatId), vb = normalizeVatId(b.issuerVatId)
  if (va && vb) return va === vb ? 'vat' : null
  const na = normalizeName(a.issuerName), nb = normalizeName(b.issuerName)
  if (na && nb && na === nb) return 'name'
  return null
}

function classifyOne(c: Fingerprint, e: Fingerprint): DuplicateMatch | null {
  // 1) Ugyanaz a fájl — biztos.
  if (c.sha256 && e.sha256 && c.sha256 === e.sha256) {
    return { cls: 'certain', existingId: e.id, reasons: ['azonos fájl (SHA-256)'] }
  }

  // 2) Sztornó / jóváírás / helyesbítő, ami az egyik meglévő számlára hivatkozik.
  if (CORRECTION_KINDS.has(String(c.kind)) && c.relatedNumber && e.externalNumber &&
      normalizeNumber(c.relatedNumber) === normalizeNumber(e.externalNumber)) {
    return { cls: 'correction', existingId: e.id, reasons: [`az eredeti számlára (${e.externalNumber}) hivatkozik`] }
  }

  const issuer = sameIssuer(c, e)
  const cn = normalizeNumber(c.externalNumber), en = normalizeNumber(e.externalNumber)
  const sameCurrency = !!c.currency && !!e.currency && c.currency === e.currency
  const sameGross = c.grossCents != null && e.grossCents != null && c.grossCents === e.grossCents && sameCurrency

  // 3) Ugyanaz a kibocsátó és számlaszám.
  if (issuer && cn && en && cn === en) {
    const reasons = [`azonos kibocsátó (${issuer === 'vat' ? 'adószám' : 'név'}) és számlaszám`]
    if (sameGross) {
      reasons.push('azonos végösszeg')
      // Adószámos egyezés + azonos összeg → biztos; névalapún csak valószínű.
      return { cls: issuer === 'vat' ? 'certain' : 'probable', existingId: e.id, reasons }
    }
    reasons.push('de a végösszeg eltér — újrakiállítás vagy hiba lehet, ember dönt')
    return { cls: 'probable', existingId: e.id, reasons }
  }

  // 4) Más/hiányzó számlaszám, de ugyanaz a gazdasági esemény: azonos kibocsátó,
  //    összeg, pénznem, közeli dátum. Nem szabad összevonni.
  if (issuer && sameGross && cn !== en) {
    const dc = toDay(c.issueDate), de = toDay(e.issueDate)
    if (dc != null && de != null && Math.abs(dc - de) <= SAME_EVENT_WINDOW_DAYS) {
      return {
        cls: 'same_event', existingId: e.id,
        reasons: ['azonos kibocsátó, összeg, pénznem és közeli dátum, de eltérő számlaszám'],
      }
    }
  }
  return null
}

/** Az összes nem-különálló találat, a legerősebb elöl. Üres lista = különálló. */
export function findDuplicates(candidate: Fingerprint, existing: Fingerprint[]): DuplicateMatch[] {
  const out: DuplicateMatch[] = []
  for (const e of existing) {
    if (candidate.id && e.id === candidate.id) continue
    const m = classifyOne(candidate, e)
    if (m) out.push(m)
  }
  return out.sort((a, b) => RANK[a.cls] - RANK[b.cls])
}

export function classifyDuplicate(candidate: Fingerprint, existing: Fingerprint[]): DuplicateClass {
  return findDuplicates(candidate, existing)[0]?.cls ?? 'distinct'
}
