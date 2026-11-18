'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileCheck, Upload, CheckCircle, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Paperclip } from 'lucide-react'
import Modal from '@/components/Modal'

interface Issue { code: string; severity: 'error' | 'warning'; message: string }
interface Doc {
  id: string
  originalFilename: string
  sha256: string
  originalFileStored: boolean
  hashVerifiedAt: string | null
  kind: string
  direction: string | null
  status: string
  externalNumber: string | null
  relatedNumber: string | null
  issueDate: string | null
  supplyDate: string | null
  dueDate: string | null
  issuer: { name: string | null; vatId: string | null }
  recipient: { name: string | null; vatId: string | null }
  currency: string | null
  amounts: { net: number | null; vat: number | null; gross: number | null }
  issues: Issue[] | null
  duplicateClass: string | null
  duplicateOfId: string | null
  review: { by: string | null; at: string | null; note: string | null }
  links: { expenseId: string | null }
  importedBy: string | null
}
interface DocDetail extends Doc { events: { id: string; actor: string; action: string; detail: unknown; createdAt: string }[] }

interface UploadResult {
  file: File
  outcome: 'attached' | 'already_attached' | 'no_record' | 'hash_adopted' | 'rejected' | 'error'
  documentId?: string
  reason?: string
  candidates?: { id: string; originalFilename: string; claimedSha256: string }[]
}

const STATUS_LABEL: Record<string, string> = {
  needs_review: 'Ellenőrzésre vár', recorded: 'Rögzítve', duplicate: 'Duplikátum', rejected: 'Elutasított', error: 'Hiba', received: 'Beérkezett',
}
const STATUS_COLOR: Record<string, string> = {
  needs_review: 'bg-amber-100 text-amber-700', recorded: 'bg-green-100 text-green-700', duplicate: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700', error: 'bg-red-100 text-red-700', received: 'bg-blue-100 text-blue-700',
}
const KIND_LABEL: Record<string, string> = {
  outgoing_invoice: 'Kimenő számla', incoming_invoice: 'Bejövő számla', credit_note: 'Jóváírás', storno: 'Sztornó', correction: 'Helyesbítő',
  receipt: 'Nyugta', advance_invoice: 'Előlegszámla', final_invoice: 'Végszámla', bank_statement: 'Bankkivonat',
  payment_confirmation: 'Fizetési visszaigazolás', other: 'Egyéb',
}
const DUP_LABEL: Record<string, string> = {
  certain: 'biztos duplikátum', probable: 'valószínű duplikátum', same_event: 'azonos gazdasági esemény, más számlaszám', correction: 'helyesbítés / sztornó egy meglévő számlához',
}
const NEEDS_CONFIRM = ['probable', 'same_event', 'correction']
const TABS: { key: string; label: string }[] = [
  { key: 'needs_review', label: 'Ellenőrzésre vár' }, { key: 'recorded', label: 'Rögzítve' },
  { key: 'duplicate', label: 'Duplikátum' }, { key: 'rejected', label: 'Elutasított' }, { key: '', label: 'Mind' },
]

const money = (n: number | null, cur: string | null) =>
  n == null ? '—' : n.toLocaleString('hu-HU', { style: 'currency', currency: cur && /^[A-Z]{3}$/.test(cur) ? cur : 'EUR' })

export default function FinanceDocumentsPage() {
  const [tab, setTab] = useState('needs_review')
  const [docs, setDocs] = useState<Doc[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [unverified, setUnverified] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<UploadResult[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const q = tab ? `?status=${tab}` : ''
    const res = await fetch(`/api/finance/documents${q}`)
    const j = await res.json().catch(() => ({}))
    setDocs(Array.isArray(j.documents) ? j.documents : [])
    setCounts(j.counts ?? {})
    setUnverified(j.unverified ?? 0)
    setLoading(false)
  }, [tab])
  useEffect(() => { load() }, [load])

  async function uploadOne(file: File, adoptFor?: string): Promise<UploadResult> {
    const fd = new FormData()
    fd.append('file', file)
    if (adoptFor) fd.append('adopt_for', adoptFor)
    try {
      const res = await fetch('/api/finance/originals', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({ outcome: 'error', reason: `Szerverhiba (${res.status})` }))
      return { file, ...j }
    } catch {
      return { file, outcome: 'error', reason: 'Nem sikerült kapcsolódni a szerverhez.' }
    }
  }

  async function uploadMany(files: File[]) {
    setUploading(true)
    const out: UploadResult[] = []
    for (const f of files) {
      out.push(await uploadOne(f))
      setResults([...out])
    }
    setUploading(false)
    load()
  }

  async function adopt(r: UploadResult, docId: string) {
    const next = await uploadOne(r.file, docId)
    setResults((all) => all.map((x) => (x === r ? next : x)))
    load()
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-5">
        <FileCheck size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bizonylatok</h1>
          <p className="text-gray-500 mt-0.5">Az ügynök által rögzített számlák és bizonylatok. A hibátlanok egyből rögzülnek, itt csak a kivételek várnak rád.</p>
        </div>
      </div>

      {unverified > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-sm text-amber-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span><strong>{unverified} dokumentum eredetije nincs feltöltve.</strong> Amíg nincs, az SHA-256 csak a ChatGPT állítása, a szerver nem igazolta. Töltsd fel az eredeti fájlokat lent.</span>
        </div>
      )}

      {/* Eredeti fájlok feltöltése */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-start gap-3">
          <Upload size={18} className="text-gray-400 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Eredeti fájlok feltöltése</h2>
            <p className="text-sm text-gray-500 mt-1">
              Válaszd ki a számlák eredeti PDF-jeit (egyszerre többet is). A szerver kiszámolja az SHA-256-ot, és ez alapján megkeresi a rekordot. Egyezéskor a dokumentum „ellenőrzött" lesz. Fájlonként legfeljebb 4 MB; PDF, XML, PNG, JPG.
            </p>
            <input ref={fileRef} type="file" multiple accept=".pdf,.xml,.png,.jpg,.jpeg" className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) uploadMany(f); if (fileRef.current) fileRef.current.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {uploading ? 'Feltöltés folyamatban…' : 'Fájlok kiválasztása'}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-lg text-sm">
            {results.map((r, i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {r.outcome === 'attached' || r.outcome === 'hash_adopted' ? <CheckCircle size={15} className="text-green-600 shrink-0" />
                    : r.outcome === 'already_attached' ? <Paperclip size={15} className="text-gray-400 shrink-0" />
                    : r.outcome === 'no_record' ? <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    : <XCircle size={15} className="text-red-500 shrink-0" />}
                  <span className="font-medium text-gray-800">{r.file.name}</span>
                  <span className="text-gray-500">
                    {r.outcome === 'attached' && '— csatolva, a hash egyezik'}
                    {r.outcome === 'hash_adopted' && '— csatolva, a rekord hash-e a valódi fájlra javítva'}
                    {r.outcome === 'already_attached' && '— már fel volt töltve'}
                    {r.outcome === 'no_record' && '— nincs ehhez a fájlhoz rekord (a ChatGPT hash-e eltérhet)'}
                    {(r.outcome === 'rejected' || r.outcome === 'error') && `— ${r.reason ?? 'hiba'}`}
                  </span>
                </div>
                {r.outcome === 'no_record' && (r.candidates?.length ?? 0) > 0 && (
                  <div className="mt-1.5 ml-6 text-xs text-gray-600">
                    Ugyanilyen nevű, még nem ellenőrzött rekord:
                    {r.candidates!.map((c) => (
                      <button key={c.id} onClick={() => adopt(r, c.id)}
                        className="ml-2 px-2 py-0.5 border border-amber-300 text-amber-800 rounded hover:bg-amber-50">
                        Ez az — hash javítása
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="mb-5 group">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">Ritkán kell: felhatalmazás Arthurnak a kivételes tételek jóváhagyására</summary>
        <div className="mt-3"><DelegationPanel onChanged={load} /></div>
      </details>
      <BulkReviewPanel onChanged={load} />

      {/* Fülek */}
      <div className="flex flex-wrap gap-1 mb-3">
        {TABS.map((t) => {
          const n = t.key ? counts[t.key] ?? 0 : total
          return (
            <button key={t.key || 'all'} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t.label} <span className="opacity-70">({n})</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Betöltés…</div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Nincs megjeleníthető dokumentum ebben a nézetben.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
              <tr><th className="px-4 py-2">Állapot</th><th className="px-4 py-2">Típus</th><th className="px-4 py-2">Kibocsátó</th><th className="px-4 py-2">Számlaszám</th><th className="px-4 py-2">Dátum</th><th className="px-4 py-2 text-right">Bruttó</th><th className="px-4 py-2">Jelzés</th><th className="px-4 py-2">Eredeti</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((d) => {
                const errs = (d.issues ?? []).filter((i) => i.severity === 'error').length
                const warns = (d.issues ?? []).filter((i) => i.severity === 'warning').length
                return (
                  <tr key={d.id} onClick={() => setSelected(d.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status] ?? ''}`}>{STATUS_LABEL[d.status] ?? d.status}</span></td>
                    <td className="px-4 py-2.5 text-gray-700">{KIND_LABEL[d.kind] ?? d.kind}</td>
                    <td className="px-4 py-2.5 text-gray-700">{d.issuer.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{d.externalNumber ?? <span className="text-gray-400">{d.originalFilename}</span>}</td>
                    <td className="px-4 py-2.5 text-gray-500">{d.issueDate ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{money(d.amounts.gross, d.currency)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {errs > 0 && <span className="text-red-600 font-medium">{errs} hiba </span>}
                      {warns > 0 && <span className="text-amber-600">{warns} figyelmeztetés </span>}
                      {d.duplicateClass && <span className="text-gray-500">{d.duplicateClass === 'certain' ? 'duplikátum' : 'hasonló van'}</span>}
                    </td>
                    <td className="px-4 py-2.5">{d.hashVerifiedAt ? <ShieldCheck size={16} className="text-green-600" /> : <ShieldAlert size={16} className="text-amber-500" />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && <DetailModal id={selected} onClose={() => setSelected(null)} onOpen={setSelected} onChanged={load} />}
    </div>
  )
}


interface BulkItem {
  id: string
  originalFilename: string
  kind: string
  externalNumber: string | null
  issuerName: string | null
  issueDate: string | null
  gross: number
  originalVerified: boolean
}
interface BulkPreview {
  items: BulkItem[]
  count: number
  missingOriginal: number
  limitPerRequest: number
  note: string
}

// The button is deliberately a HUMAN review action. ChatGPT/MCP has no access
// to this endpoint. The server re-checks each document and never auto-confirms
// warnings, duplicate suspicion or Expense collisions.
function BulkReviewPanel({ onChanged }: { onChanged: () => void }) {
  const [preview, setPreview] = useState<BulkPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [waive, setWaive] = useState(false)
  const [waiverReason, setWaiverReason] = useState(
    'Korábban könyvelt dokumentum, az eredeti PDF az adóbevallási csomagban és a könyvelőnél megőrizve.',
  )
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/finance/documents/bulk-review', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Nem sikerült lekérni az ellenőrzési listát.')
      setPreview(data)
      setConfirmed(false)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!preview || busy || !confirmed) return
    const items = preview.items.filter((d) => waive || d.originalVerified)
    if (items.length === 0) {
      setMessage('Nincs szerver által ellenőrzött eredeti PDF. Töltsd fel a fájlokat, vagy indokold a mellőzésüket.')
      return
    }
    if (waive && waiverReason.trim().length < 10) {
      setMessage('Az eredeti PDF mellőzését indokolni kell.')
      return
    }
    if (!window.confirm(`Jóváhagyod a ${items.length} kiválasztott, figyelmeztetésmentes tételt? A bejövő számlák/nyugták ekkor éles Expense rekordokat hozhatnak létre.`)) return

    setBusy(true)
    setMessage('Jóváhagyás folyamatban…')
    let approved = 0, left = 0, errors = 0
    try {
      for (let i = 0; i < items.length; i += 10) {
        const batch = items.slice(i, i + 10)
        const res = await fetch('/api/finance/documents/bulk-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: batch.map((d) => d.id),
            confirmReviewed: true,
            waiveOriginal: waive,
            note: waive ? waiverReason : 'Bizonylatok emberi tömeges ellenőrzése.',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `Hiba a ${i + 1}. tételtől.`)
        approved += data.approved ?? 0
        left += data.leftForHuman ?? 0
        errors += data.errors ?? 0
        setMessage(`Feldolgozva: ${Math.min(i + 10, items.length)}/${items.length}. Jóváhagyva: ${approved}; függőben: ${left}; hiba: ${errors}.`)
      }
      onChanged()
      const res = await fetch('/api/finance/documents/bulk-review', { cache: 'no-store' })
      if (res.ok) setPreview(await res.json())
      setConfirmed(false)
    } catch (err) {
      setMessage(`Részleges eredmény: ${approved} jóváhagyva, ${left} függőben, ${errors} hiba. ${err instanceof Error ? err.message : String(err)}`)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 text-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Tömeges emberi jóváhagyás</h2>
      <p className="text-gray-600 mb-3">
        Csak figyelmeztetésmentes, cent-pontosan egyező, nem duplikációgyanús számlák és nyugták.
        A szerver a Könyvelésben már meglévő költséget is ellenőrzi; azt nem duplázza meg automatikusan.
      </p>
      <button type="button" onClick={refresh} disabled={busy}
        className="px-3 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50">
        Ellenőrizhető tételek előnézete
      </button>
      {preview && (
        <div className="mt-3 space-y-3">
          <p className="font-medium">Jelzésmentes: {preview.count} dokumentum · ebből eredeti PDF nélküli: {preview.missingOriginal}</p>
          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer font-medium">A teljes jelöltlista megnyitása ({preview.count})</summary>
            <div className="max-h-64 overflow-y-auto mt-2">
              {preview.items.map((d) => (
                <div key={d.id} className="py-1 border-t border-gray-100 flex gap-3 justify-between">
                  <span>{d.externalNumber ?? d.originalFilename} · {d.issuerName ?? 'Ismeretlen'}</span>
                  <span className="whitespace-nowrap">{money(d.gross, 'EUR')} {d.originalVerified ? '· PDF igazolt' : '· PDF nincs'}</span>
                </div>
              ))}
            </div>
          </details>
          {preview.missingOriginal > 0 && (
            <label className="flex gap-2 items-start">
              <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} />
              <span>Az eredeti PDF hiányát kifejezetten elfogadom ezeknél a tételeknél, és a döntés naplózását kérem.</span>
            </label>
          )}
          {waive && (
            <label className="block">
              <span className="block mb-1">Indoklás a PDF mellőzéséhez</span>
              <textarea value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2" rows={2} />
            </label>
          )}
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>Átnéztem a jelöltlistát, és jóváhagyom a tiszta tételek rögzítését. A problémás tételek külön maradnak.</span>
          </label>
          <button type="button" onClick={approve} disabled={busy || !confirmed || !preview.count}
            className="px-4 py-2 bg-green-700 text-white rounded-lg disabled:opacity-40">
            {busy ? 'Feldolgozás…' : 'Ellenőrzött tételek jóváhagyása'}
          </button>
        </div>
      )}
      {message && <p role="status" className="mt-2 text-gray-700">{message}</p>}
    </div>
  )
}

// ─── Részletek, javítás, döntés ───────────────────────────────────────────

const FIELDS: { key: string; label: string; type?: 'number' | 'date'; from: (d: DocDetail) => string }[] = [
  { key: 'external_number', label: 'Eredeti számlaszám', from: (d) => d.externalNumber ?? '' },
  { key: 'issue_date', label: 'Kiállítás', type: 'date', from: (d) => d.issueDate ?? '' },
  { key: 'supply_date', label: 'Teljesítés', type: 'date', from: (d) => d.supplyDate ?? '' },
  { key: 'due_date', label: 'Fizetési határidő', type: 'date', from: (d) => d.dueDate ?? '' },
  { key: 'issuer_name', label: 'Kibocsátó', from: (d) => d.issuer.name ?? '' },
  { key: 'issuer_vat_id', label: 'Kibocsátó adószáma', from: (d) => d.issuer.vatId ?? '' },
  { key: 'recipient_name', label: 'Vevő', from: (d) => d.recipient.name ?? '' },
  { key: 'currency', label: 'Pénznem', from: (d) => d.currency ?? '' },
  { key: 'net', label: 'Nettó', type: 'number', from: (d) => (d.amounts.net == null ? '' : String(d.amounts.net)) },
  { key: 'vat', label: 'ÁFA', type: 'number', from: (d) => (d.amounts.vat == null ? '' : String(d.amounts.vat)) },
  { key: 'gross', label: 'Bruttó', type: 'number', from: (d) => (d.amounts.gross == null ? '' : String(d.amounts.gross)) },
  { key: 'related_number', label: 'Hivatkozott számla (sztornónál)', from: (d) => d.relatedNumber ?? '' },
]

function DetailModal({ id, onClose, onOpen, onChanged }: { id: string; onClose: () => void; onOpen: (id: string) => void; onChanged: () => void }) {
  const [d, setD] = useState<DocDetail | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [confirmDistinct, setConfirmDistinct] = useState(false)
  const [override, setOverride] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/documents/${id}`)
    if (!res.ok) { setMsg({ ok: false, text: 'A dokumentum nem tölthető be.' }); return }
    const j: DocDetail = await res.json()
    setD(j)
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, f.from(j)])))
  }, [id])
  useEffect(() => { setMsg(null); setNote(''); setConfirmDistinct(false); setOverride(false); load() }, [load])

  async function send(body: Record<string, unknown>) {
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/finance/documents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? `Hiba (${res.status})` }); return false }
    await load(); onChanged()
    return j
  }

  async function save() {
    if (!d) return
    const fields: Record<string, string | number | null> = {}
    for (const f of FIELDS) {
      if (form[f.key] === f.from(d)) continue
      fields[f.key] = form[f.key] === '' ? null : f.type === 'number' ? Number(form[f.key].replace(',', '.')) : form[f.key]
    }
    if (Object.keys(fields).length === 0) { setMsg({ ok: true, text: 'Nincs módosítás.' }); return }
    const j = await send({ action: 'correct', fields })
    if (j) setMsg({ ok: true, text: 'Javítva és újraellenőrizve.' })
  }

  async function decide(action: 'approve' | 'reject' | 'confirm_duplicate') {
    const j = await send({ action, note, confirmDistinct, overrideNoOriginal: override })
    if (j) setMsg({ ok: true, text: action === 'approve' ? ['Jóváhagyva.', ...(j.notes ?? [])].join(' ') : action === 'reject' ? 'Elutasítva.' : 'Duplikátumként megerősítve.' })
  }

  if (!d) return <Modal title="Dokumentum" onClose={onClose} size="xl"><p className="text-sm text-gray-500">{msg?.text ?? 'Betöltés…'}</p></Modal>
  const editable = d.status === 'needs_review'
  const issues = d.issues ?? []
  const needsConfirm = !!d.duplicateClass && NEEDS_CONFIRM.includes(d.duplicateClass)

  return (
    <Modal title={`${KIND_LABEL[d.kind] ?? d.kind} — ${d.externalNumber ?? d.originalFilename}`} onClose={onClose} size="xl">
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status] ?? ''}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
          <span className="text-gray-500">importálta: {d.importedBy ?? '—'}</span>
          {d.review.by && <span className="text-gray-500">· döntött: {d.review.by}</span>}
          {d.links.expenseId && <span className="text-green-700">· Könyvelésbe átvezetve</span>}
        </div>

        {/* Eredeti */}
        <div className={`p-3 rounded-lg border flex items-start gap-2 ${d.hashVerifiedAt ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {d.hashVerifiedAt ? <ShieldCheck size={16} className="mt-0.5 shrink-0" /> : <ShieldAlert size={16} className="mt-0.5 shrink-0" />}
          <div>
            {d.hashVerifiedAt
              ? <>Az eredeti fájl feltöltve, a szerver igazolta az SHA-256-ot. {d.originalFileStored && <a className="underline font-medium" href={`/api/finance/documents/${d.id}/original`} target="_blank" rel="noopener noreferrer">Eredeti megnyitása</a>}</>
              : <>Az eredeti fájl nincs feltöltve — az SHA-256 csak a ChatGPT állítása. Töltsd fel az oldal tetején.</>}
            <div className="font-mono text-[11px] opacity-70 mt-1 break-all">{d.sha256}</div>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((i, k) => (
              <div key={k} className={`px-3 py-2 rounded-lg ${i.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                <strong>{i.severity === 'error' ? 'Hiba: ' : 'Figyelmeztetés: '}</strong>{i.message}
              </div>
            ))}
          </div>
        )}

        {d.duplicateClass && (
          <div className="px-3 py-2 rounded-lg bg-gray-50 text-gray-700">
            Duplikáció-jelzés: <strong>{DUP_LABEL[d.duplicateClass] ?? d.duplicateClass}</strong>
            {d.duplicateOfId && <button onClick={() => onOpen(d.duplicateOfId!)} className="ml-2 text-blue-600 underline">a meglévő megnyitása</button>}
          </div>
        )}

        {/* Adatok / javítás */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Kinyert adatok {editable && <span className="text-xs font-normal text-gray-400">(javíthatók; az eredeti fájl érintetlen marad, a változás naplózódik)</span>}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-gray-500">{f.label}</span>
                <input
                  type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined}
                  value={form[f.key] ?? ''} disabled={!editable}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="mt-0.5 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
            ))}
          </div>
          {editable && (
            <button onClick={save} disabled={busy} className="mt-3 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Javítás mentése</button>
          )}
        </div>

        {/* Döntés */}
        {editable && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Döntés</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Megjegyzés (elutasításnál és kivételes jóváhagyásnál legalább 10 karakter kötelező)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            {needsConfirm && (
              <label className="flex items-start gap-2 text-gray-700"><input type="checkbox" checked={confirmDistinct} onChange={(e) => setConfirmDistinct(e.target.checked)} className="mt-0.5" />
                Ellenőriztem: ez különálló tétel, nem ugyanaz a gazdasági esemény, mint a meglévő.</label>
            )}
            {!d.hashVerifiedAt && (
              <label className="flex items-start gap-2 text-gray-700"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" />
                Kivétel: jóváhagyom az eredeti fájl nélkül (indoklás a megjegyzésben kötelező).</label>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => decide('approve')} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">Jóváhagyás</button>
              <button onClick={() => decide('reject')} disabled={busy} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-60">Elutasítás</button>
              {d.duplicateOfId && <button onClick={() => decide('confirm_duplicate')} disabled={busy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60">Duplikátum megerősítése</button>}
            </div>
          </div>
        )}

        {msg && <div className={`px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

        {/* Napló */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Napló</h3>
          <ul className="space-y-1 text-xs text-gray-600">
            {d.events.map((e) => (
              <li key={e.id}><span className="text-gray-400">{new Date(e.createdAt).toLocaleString('hu-HU')}</span> · <strong>{e.actor}</strong> · {e.action}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

// ─── Felhatalmazás az ügynöknek ───────────────────────────────────────────

interface Grant { id: string; scope: string; batchId: string | null; createdBy: string; expiresAt: string; maxGrossCents: number; allowWaiveOriginal: boolean; usedCount: number; revokedAt: string | null; active: boolean; note: string | null }
interface BatchRow { id: string; filename: string; status: string; byStatus: Record<string, number> }

function DelegationPanel({ onChanged }: { onChanged: () => void }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [scope, setScope] = useState('window')
  const [hours, setHours] = useState('24')
  const [maxGross, setMaxGross] = useState('2000')
  const [waive, setWaive] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [g, b] = await Promise.all([fetch('/api/finance/grants').then((r) => r.json()).catch(() => ({})), fetch('/api/finance/batches').then((r) => r.json()).catch(() => ({}))])
    setGrants(Array.isArray(g.grants) ? g.grants : []); setBatches(Array.isArray(b.batches) ? b.batches : [])
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    setBusy(true); setMsg(null)
    const body = { scope: scope === 'window' ? 'window' : 'batch', batchId: scope === 'window' ? null : scope, hours: Number(hours), maxGross: Number(maxGross.replace(',', '.')), allowWaiveOriginal: waive, note }
    const res = await fetch('/api/finance/grants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? `Hiba (${res.status})` }); return }
    setMsg({ ok: true, text: 'Felhatalmazás megadva. Mostantól szólhatsz Arthurnak.' }); setNote(''); load(); onChanged()
  }
  async function revoke(id: string) { await fetch(`/api/finance/grants/${id}/revoke`, { method: 'POST' }); load() }

  const active = grants.filter((g) => g.active)
  const label = (g: Grant) => g.scope === 'window' ? 'Bármely import' : `Csomag: ${batches.find((b) => b.id === g.batchId)?.filename ?? g.batchId}`

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
      <h2 className="font-semibold text-gray-900">Felhatalmazás Arthurnak (ChatGPT)</h2>
      <p className="text-sm text-gray-500 mt-1">
        Ezzel engedélyezed, hogy Arthur a <strong>hibátlan</strong> tételeket helyetted jóváhagyja. A hibás, gyanús, a határt meghaladó, és az általa javított tétel mindig emberi döntésre marad. Az engedélyt csak itt, a CRM-ben adhatod meg; a chatben mondott engedély nem számít.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
        <label className="block sm:col-span-2"><span className="text-xs text-gray-500">Mire vonatkozik</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-0.5 w-full px-3 py-1.5 border border-gray-200 rounded-lg">
            <option value="window">Bármely új import, a lejáratig</option>
            {batches.map((b) => <option key={b.id} value={b.id}>Csomag: {b.filename} ({b.byStatus.needs_review ?? 0} vár)</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-gray-500">Meddig érvényes</span>
          <select value={hours} onChange={(e) => setHours(e.target.value)} className="mt-0.5 w-full px-3 py-1.5 border border-gray-200 rounded-lg">
            <option value="1">1 óra</option><option value="24">24 óra</option><option value="72">3 nap</option><option value="168">7 nap</option>
          </select></label>
        <label className="block"><span className="text-xs text-gray-500">Összeghatár tételenként (bruttó)</span>
          <input value={maxGross} onChange={(e) => setMaxGross(e.target.value)} inputMode="decimal" className="mt-0.5 w-full px-3 py-1.5 border border-gray-200 rounded-lg" /></label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="mt-0.5" />
        Arthur indoklással mellőzheti az eredeti PDF-et (pl. már lekönyvelt csomag). Az indoklás tételenként naplózódik.</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Megjegyzés (pl. augusztusi könyvelési csomag)" className="mt-3 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
      <button onClick={create} disabled={busy} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Felhatalmazás megadása</button>
      {msg && <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {active.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-lg text-sm">
          {active.map((g) => (
            <li key={g.id} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-gray-800">{label(g)}</span>
              <span className="text-gray-500">lejár: {new Date(g.expiresAt).toLocaleString('hu-HU')}</span>
              <span className="text-gray-500">határ: {(g.maxGrossCents / 100).toLocaleString('hu-HU')} EUR</span>
              {g.allowWaiveOriginal && <span className="text-amber-700">PDF mellőzhető</span>}
              <span className="text-gray-400">{g.usedCount} jóváhagyás</span>
              <button onClick={() => revoke(g.id)} className="ml-auto text-red-600 hover:underline">Visszavonás</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
