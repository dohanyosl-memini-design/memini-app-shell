'use client'

import { useState } from 'react'
import { Mail, Plus, X, Check, RotateCcw, FileText, Copy } from 'lucide-react'
import Modal from '@/components/Modal'
import { parseSequence, type SequenceStep } from '@/lib/emailSequence'

// A küldendő nyelv címkéje a cég language mezője alapján.
const LANG_LABEL: Record<string, string> = { DE: 'Deutsch', EN: 'English', HU: 'Magyar', MULTI: 'Küldendő' }

// Kézi email-sorozat követése egy leadnél. NEM küld — csak jelöli, mi ment ki
// és mi van hátra. A küldést te végzed (vagy Arthur segít megfogalmazni).

function newStep(): SequenceStep {
  return {
    id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    dueAt: new Date().toISOString().slice(0, 10),
    sentAt: null,
  }
}

function fmtSent(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

function isOverdue(step: SequenceStep): boolean {
  if (step.sentAt || step.skipped || !step.dueAt) return false
  return step.dueAt < new Date().toISOString().slice(0, 10)
}

export default function EmailSequencePanel({
  companyId,
  initial,
  language,
}: {
  companyId: string
  initial: unknown
  language?: string | null
}) {
  const [steps, setSteps] = useState<SequenceStep[]>(() => parseSequence(initial)?.steps ?? [])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const sendLang = LANG_LABEL[language || 'DE'] ?? 'Küldendő'
  const editingStep = steps.find((s) => s.id === editingId) ?? null

  async function persist(next: SequenceStep[]) {
    setSteps(next)
    setSaving(true)
    await fetch(`/api/companies/${companyId}/sequence`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: next }),
    })
    setSaving(false)
  }

  async function loadTemplate() {
    setSaving(true)
    const res = await fetch(`/api/companies/${companyId}/sequence`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    })
    const seq = await res.json()
    setSteps(parseSequence(seq)?.steps ?? [])
    setSaving(false)
  }

  function update(id: string, patch: Partial<SequenceStep>) {
    persist(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }
  function toggleSent(s: SequenceStep) {
    update(s.id, { sentAt: s.sentAt ? null : new Date().toISOString() })
  }
  function remove(id: string) {
    persist(steps.filter((s) => s.id !== id))
  }
  function add() {
    persist([...steps, newStep()])
  }

  const sentCount = steps.filter((s) => !s.skipped && s.sentAt).length
  const activeCount = steps.filter((s) => !s.skipped).length

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Mail size={15} className="text-orange-500" />
          Email-sorozat
          {activeCount > 0 && (
            <span className="text-xs font-normal text-gray-400">{sentCount}/{activeCount} kiment</span>
          )}
          {saving && <span className="text-xs font-normal text-gray-300">mentés…</span>}
        </h3>
        {steps.length === 0 ? (
          <button onClick={loadTemplate} className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
            <Plus size={13} /> Sablon betöltése
          </button>
        ) : (
          <button onClick={loadTemplate} title="Sablon visszatöltése (felülírja a mostanit)" className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
            <RotateCcw size={12} /> Sablon
          </button>
        )}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nincs sorozat. Meleg leaddé váláskor magától kiosztódik, vagy töltsd be a sablont.
        </p>
      ) : (
        <div className="space-y-1.5">
          {steps.map((s) => {
            const overdue = isOverdue(s)
            return (
              <div key={s.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${s.sentAt ? 'border-green-100 bg-green-50/40' : overdue ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                {/* Kiment pipa */}
                <button
                  onClick={() => toggleSent(s)}
                  title={s.sentAt ? `Kiment: ${fmtSent(s.sentAt)} — kattints a visszavonáshoz` : 'Jelöld kimentként'}
                  className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${s.sentAt ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-green-400'}`}
                >
                  <Check size={12} />
                </button>

                {/* Cím */}
                <input
                  value={s.label}
                  onChange={(e) => setSteps(steps.map((x) => x.id === s.id ? { ...x, label: e.target.value } : x))}
                  onBlur={() => persist(steps)}
                  placeholder="Lépés megnevezése…"
                  className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${s.sentAt ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                />

                {/* Esedékesség vagy kiment dátum */}
                {s.sentAt ? (
                  <span className="text-xs text-green-600 shrink-0">kiment: {fmtSent(s.sentAt)}</span>
                ) : (
                  <input
                    type="date"
                    value={s.dueAt ?? ''}
                    onChange={(e) => update(s.id, { dueAt: e.target.value || null })}
                    className={`text-xs shrink-0 bg-transparent focus:outline-none ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}
                  />
                )}

                {/* Levél-szerkesztő megnyitása ehhez a lépéshez */}
                <button
                  onClick={() => setEditingId(s.id)}
                  title={s.body || s.subject ? 'Levél szerkesztése (van piszkozat)' : 'Levél megírása / szerkesztése'}
                  className={`shrink-0 ${s.body || s.subject ? 'text-orange-500 hover:text-orange-600' : 'text-gray-300 hover:text-gray-600'}`}
                >
                  <FileText size={14} />
                </button>

                <button onClick={() => remove(s.id)} className="shrink-0 text-gray-300 hover:text-red-500" title="Lépés törlése">
                  <X size={14} />
                </button>
              </div>
            )
          })}

          <button onClick={add} className="mt-1 text-xs font-medium text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
            <Plus size={13} /> Lépés hozzáadása
          </button>
        </div>
      )}

      {editingStep && (
        <LetterEditor
          step={editingStep}
          sendLang={sendLang}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            persist(steps.map((s) => (s.id === editingStep.id ? { ...s, ...patch, draftUpdatedAt: new Date().toISOString() } : s)))
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}

// ── Levél-szerkesztő: tárgy + két hasáb (küldő nyelv | magyar kontroll) ──
function LetterEditor({
  step, sendLang, onClose, onSave,
}: {
  step: SequenceStep
  sendLang: string
  onClose: () => void
  onSave: (patch: Pick<SequenceStep, 'subject' | 'body' | 'bodyHu'>) => void
}) {
  const [subject, setSubject] = useState(step.subject ?? '')
  const [body, setBody] = useState(step.body ?? '')
  const [bodyHu, setBodyHu] = useState(step.bodyHu ?? '')
  const [copied, setCopied] = useState(false)

  async function copySend() {
    const text = `${subject ? `Betreff / Tárgy: ${subject}\n\n` : ''}${body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* a vágólap nem mindig elérhető */ }
  }

  const ta = 'w-full h-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none font-mono'

  return (
    <Modal title={`Levél: ${step.label}`} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tárgy</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A levél tárgya…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Küldendő ({sendLang})</label>
              <button onClick={copySend} className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
                <Copy size={12} /> {copied ? 'Másolva!' : 'Másolás'}
              </button>
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ezt küldöd el a partnernek…" className={ta} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Magyar (kontroll)</label>
            <textarea value={bodyHu} onChange={(e) => setBodyHu(e.target.value)} placeholder="Ugyanez magyarul — hogy lásd, mit mondasz…" className={ta} />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          A piszkozatot Arthur is megírhatja/frissítheti MCP-n. A küldés kézi: másold ki a bal (küldendő) hasábot, és a saját rendszeredből küldd el.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Bezárás</button>
          <button onClick={() => onSave({ subject: subject.trim() || null, body: body.trim() || null, bodyHu: bodyHu.trim() || null })} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700">
            Mentés
          </button>
        </div>
      </div>
    </Modal>
  )
}
