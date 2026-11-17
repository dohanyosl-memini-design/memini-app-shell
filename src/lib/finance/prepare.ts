import { toCents } from './money'
import type { DocKind } from './validate'

export const DOC_KINDS = [
  'outgoing_invoice', 'incoming_invoice', 'credit_note', 'storno', 'correction',
  'receipt', 'advance_invoice', 'final_invoice', 'bank_statement',
  'payment_confirmation', 'other',
] as const satisfies readonly DocKind[]

export type Direction = 'outgoing' | 'incoming'

/** A hívótól érkező nyers adat: az összegek tizedes számok (pl. 1097.18), a dátumok YYYY-MM-DD. */
export interface RawDocInput {
  original_filename: string
  sha256: string
  kind: DocKind
  direction?: Direction
  mime_type?: string
  size_bytes?: number
  source?: string
  external_number?: string
  issue_date?: string
  supply_date?: string
  due_date?: string
  issuer_name?: string
  issuer_vat_id?: string
  recipient_name?: string
  recipient_vat_id?: string
  currency?: string
  net?: number
  vat?: number
  gross?: number
  line_nets?: number[]
  related_number?: string
  source_json?: string
}

export interface PreparedDoc {
  originalFilename: string
  sha256: string
  mimeType: string | null
  sizeBytes: number
  source: string
  kind: DocKind
  direction: Direction | null
  externalNumber: string | null
  issueDate: Date | null
  supplyDate: Date | null
  dueDate: Date | null
  issuerName: string | null
  issuerVatId: string | null
  recipientName: string | null
  recipientVatId: string | null
  currency: string | null
  netCents: number | null
  vatCents: number | null
  grossCents: number | null
  lineNetCents: number[] | null
  relatedNumber: string | null
  sourceData: unknown | null
}

export type Prepared = { ok: true; doc: PreparedDoc } | { ok: false; reason: string }

const MAX_CENTS = 2_100_000_000 // az Int-oszlop határa alatt (≈ 21 millió)
const MAX_SOURCE_JSON = 100_000

const str = (v?: string | null): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Szigorú YYYY-MM-DD; a 2026-02-31-et elutasítja (a Date magától átgörgetné). */
export function parseDay(v: string | undefined, label: string): { value: Date | null; error?: string } {
  const s = str(v)
  if (!s) return { value: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: null, error: `${label}: érvénytelen dátum „${s}" (YYYY-MM-DD kell)` }
  const d = new Date(`${s}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return { value: null, error: `${label}: nem létező dátum „${s}"` }
  }
  return { value: d }
}

export function parseAmount(v: number | undefined, label: string): { value: number | null; error?: string } {
  if (v === undefined || v === null) return { value: null }
  if (typeof v !== 'number' || !Number.isFinite(v)) return { value: null, error: `${label}: érvénytelen összeg` }
  const c = toCents(v)
  if (Math.abs(c) > MAX_CENTS) return { value: null, error: `${label}: az összeg meghaladja a tárolható tartományt` }
  return { value: c }
}

export function prepareDocument(raw: RawDocInput): Prepared {
  const filename = str(raw.original_filename)
  if (!filename) return { ok: false, reason: 'Hiányzik az eredeti fájlnév.' }

  const sha = (raw.sha256 ?? '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    return { ok: false, reason: 'Az sha256 hibás: 64 hexadecimális karakter kell az ORIGINAL fájl bájtjaiból számolva.' }
  }

  // Irány: a típusból következik, ha egyértelmű; ellentmondást nem fogadunk el.
  const implied: Direction | null =
    raw.kind === 'outgoing_invoice' ? 'outgoing' : raw.kind === 'incoming_invoice' ? 'incoming' : null
  if (implied && raw.direction && raw.direction !== implied) {
    return { ok: false, reason: `A típus (${raw.kind}) és az irány (${raw.direction}) ellentmond.` }
  }
  const direction = raw.direction ?? implied

  const errors: string[] = []
  const issue = parseDay(raw.issue_date, 'Kiállítás dátuma')
  const supply = parseDay(raw.supply_date, 'Teljesítés dátuma')
  const due = parseDay(raw.due_date, 'Fizetési határidő')
  for (const p of [issue, supply, due]) if (p.error) errors.push(p.error)

  const net = parseAmount(raw.net, 'Nettó')
  const vat = parseAmount(raw.vat, 'ÁFA')
  const gross = parseAmount(raw.gross, 'Bruttó')
  for (const p of [net, vat, gross]) if (p.error) errors.push(p.error)

  let lineNetCents: number[] | null = null
  if (raw.line_nets && raw.line_nets.length > 0) {
    lineNetCents = []
    for (let i = 0; i < raw.line_nets.length; i++) {
      const p = parseAmount(raw.line_nets[i], `Sor ${i + 1} nettó`)
      if (p.error || p.value == null) { errors.push(p.error ?? `Sor ${i + 1} nettó: hiányzik`); break }
      lineNetCents.push(p.value)
    }
  }

  const currency = str(raw.currency)?.toUpperCase() ?? null
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.push(`Pénznem: érvénytelen kód „${currency}" (3 betűs kód kell, pl. EUR)`)

  let sourceData: unknown = null
  if (raw.source_json !== undefined && raw.source_json !== '') {
    if (raw.source_json.length > MAX_SOURCE_JSON) errors.push('A source_json túl nagy.')
    else { try { sourceData = JSON.parse(raw.source_json) } catch { sourceData = { raw: raw.source_json } } }
  }

  if (errors.length) return { ok: false, reason: errors.join('; ') }

  return {
    ok: true,
    doc: {
      originalFilename: filename,
      sha256: sha,
      mimeType: str(raw.mime_type),
      sizeBytes: Number.isInteger(raw.size_bytes) && (raw.size_bytes as number) >= 0 ? (raw.size_bytes as number) : 0,
      source: str(raw.source) ?? 'chatgpt',
      kind: raw.kind,
      direction,
      externalNumber: str(raw.external_number),
      issueDate: issue.value, supplyDate: supply.value, dueDate: due.value,
      issuerName: str(raw.issuer_name), issuerVatId: str(raw.issuer_vat_id),
      recipientName: str(raw.recipient_name), recipientVatId: str(raw.recipient_vat_id),
      currency,
      netCents: net.value, vatCents: vat.value, grossCents: gross.value,
      lineNetCents,
      relatedNumber: str(raw.related_number),
      sourceData,
    },
  }
}
