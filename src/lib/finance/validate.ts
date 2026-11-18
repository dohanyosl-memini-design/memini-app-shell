export type DocKind =
  | 'outgoing_invoice' | 'incoming_invoice' | 'credit_note' | 'storno' | 'correction'
  | 'receipt' | 'advance_invoice' | 'final_invoice' | 'bank_statement'
  | 'payment_confirmation' | 'other'

export type Severity = 'error' | 'warning'
export interface Issue { code: string; severity: Severity; message: string }

export interface AmountInput {
  kind?: DocKind | string | null
  currency?: string | null
  netCents?: number | null
  vatCents?: number | null
  grossCents?: number | null
  /** Sorok nettó összege centben, ha ismert (soronkénti ellenőrzéshez). */
  lineNetCents?: number[] | null
}

// Az ismert ÁFA-kulcsok százalékban (DE, HU, AT). Ami ezeken kívül esik, nem hiba,
// de emberi ellenőrzést kap — az adójogi besorolást nem találgatjuk.
const KNOWN_VAT_RATES = [0, 5, 7, 10, 13, 18, 19, 20, 27]
const NEGATIVE_KINDS = new Set(['credit_note', 'storno'])
// Ezeknek a dokumentumoknak nem kell számla-összeg és pénznem (bankkivonat, fizetési visszaigazolás, egyéb).
const AMOUNTLESS_KINDS = new Set(['bank_statement', 'payment_confirmation', 'other'])

/**
 * Egy dokumentum összegeinek ellenőrzése. A szabály: ami a dokumentumon áll,
 * annak pontosan (centre) stimmelnie kell; ha nem, az ellenőrzésre vár — nem
 * javítjuk csendben. Az 'error' súlyú tétel nem kerülhet automatikusan rögzítésre.
 */
export function validateAmounts(input: AmountInput): Issue[] {
  const issues: Issue[] = []
  const { netCents: net, vatCents: vat, grossCents: gross } = input
  if (AMOUNTLESS_KINDS.has(String(input.kind)) && [net, vat, gross].every((v) => v == null)) return issues

  if (!input.currency) {
    issues.push({ code: 'CURRENCY_MISSING', severity: 'error', message: 'Hiányzik a pénznem.' })
  }

  const present = [net, vat, gross].filter((v) => v != null).length
  if (present === 0) {
    issues.push({ code: 'AMOUNTS_MISSING', severity: 'error', message: 'Nincs kinyert összeg.' })
    return issues
  }

  if (net != null && vat != null && gross != null) {
    if (net + vat !== gross) {
      issues.push({
        code: 'SUM_MISMATCH', severity: 'error',
        message: `Nettó + ÁFA ≠ bruttó: ${net} + ${vat} = ${net + vat}, a dokumentumon ${gross} (cent).`,
      })
    }
  } else if (present < 3) {
    issues.push({
      code: 'AMOUNT_INCOMPLETE', severity: 'warning',
      message: 'Nem mind a három összeg (nettó, ÁFA, bruttó) szerepel; a hiányzó nem pótolható ellenőrizetlenül.',
    })
  }

  // Előjel: sztornó/jóváírás negatív, a többi nem.
  const amount = gross ?? net
  if (amount != null) {
    const expectNegative = NEGATIVE_KINDS.has(String(input.kind))
    if (expectNegative && amount > 0) {
      issues.push({ code: 'SIGN_UNEXPECTED', severity: 'warning', message: 'Sztornó/jóváírás pozitív összeggel — ellenőrizd az előjelet.' })
    }
    if (!expectNegative && amount < 0) {
      issues.push({ code: 'SIGN_UNEXPECTED', severity: 'warning', message: 'Negatív összeg nem sztornó/jóváírás típusú dokumentumon.' })
    }
  }

  // ÁFA-kulcs: csak jelzés, besorolást nem végzünk.
  if (net != null && vat != null && net !== 0) {
    const rate = Math.abs(vat / net) * 100
    if (vat === 0) {
      issues.push({
        code: 'ZERO_VAT', severity: 'warning',
        message: '0 ÁFA — adómentes, reverse charge vagy külföldi tétel lehet; az adójogi besorolást emberi ellenőrzés dönti el.',
      })
    } else if (!KNOWN_VAT_RATES.some((r) => Math.abs(rate - r) < 0.3)) {
      issues.push({
        code: 'UNUSUAL_VAT_RATE', severity: 'warning',
        message: `Szokatlan ÁFA-arány (${rate.toFixed(2)}%) — több kulcs vagy hiba lehet.`,
      })
    }
  }

  if (input.lineNetCents && input.lineNetCents.length > 0 && net != null) {
    const sum = input.lineNetCents.reduce((a, b) => a + b, 0)
    if (sum !== net) {
      issues.push({ code: 'LINE_SUM_MISMATCH', severity: 'error', message: `A sorok nettó összege (${sum}) nem egyezik a végösszeggel (${net}).` })
    }
  }

  return issues
}

/** Az import ebből dönt: hibás → 'error' kategória-jelzés, figyelmeztetés → ellenőrzésre vár. */
export function statusFromIssues(issues: Issue[]): 'needs_review' | 'recorded' {
  return issues.length === 0 ? 'recorded' : 'needs_review'
}
