'use client'

import { useState } from 'react'
import { Mail, Plus, X, Check, RotateCcw } from 'lucide-react'
import { parseSequence, type SequenceStep } from '@/lib/emailSequence'

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
}: {
  companyId: string
  initial: unknown
}) {
  const [steps, setSteps] = useState<SequenceStep[]>(() => parseSequence(initial)?.steps ?? [])
  const [saving, setSaving] = useState(false)

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
    </div>
  )
}
