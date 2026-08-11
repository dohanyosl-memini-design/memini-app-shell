'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface TemplateStep {
  id: string
  order: number
  label: string
  offsetDays: number
  subject: string | null
  brief: string | null
  sampleBody: string | null
}

// A meleg lead email-sorozat KÖZPONTI sablonja. Ez a mérce: az ügynök e szerint
// írja a leveleket, csak személyre szabva. Innen szerkeszthető mindenkire nézve.
export default function EmailSequenceTemplateSection() {
  const [steps, setSteps] = useState<TemplateStep[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/email-template')
    setSteps(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  function patchLocal(id: string, p: Partial<TemplateStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }

  async function save(step: TemplateStep) {
    await fetch(`/api/email-template/${step.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: step.label, offsetDays: step.offsetDays, subject: step.subject,
        brief: step.brief, sampleBody: step.sampleBody, order: step.order,
      }),
    })
    setSavedId(step.id)
    setTimeout(() => setSavedId((v) => (v === step.id ? null : v)), 1500)
  }

  async function addStep() {
    const res = await fetch('/api/email-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Új levél', offsetDays: 0 }),
    })
    const created = await res.json()
    await load()
    setOpenId(created.id)
  }

  async function remove(id: string) {
    if (!confirm('Biztosan törlöd ezt a levelet a sablonból?')) return
    await fetch(`/api/email-template/${id}`, { method: 'DELETE' })
    load()
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Mail size={18} className="text-orange-500" /> Email-sorozat sablon
        </h2>
        <button onClick={addStep} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
          <Plus size={15} /> Levél hozzáadása
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        A mindenkinek közös sorozat. Amikor valakit behúzol a Meleg leadbe, ez másolódik a leadhez.
        Az ügynök ezt látja, és <strong>e szerint</strong> írja a leveleket — csak személyre szabja.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Betöltés…</p>
      ) : (
        <div className="space-y-2">
          {steps.map((s) => {
            const open = openId === s.id
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                  <button onClick={() => setOpenId(open ? null : s.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className="text-xs font-medium text-gray-400 shrink-0">nap {s.offsetDays}</span>
                    <span className="font-medium text-gray-800 truncate">{s.label}</span>
                  </button>
                  {savedId === s.id && <span className="text-xs text-green-600 inline-flex items-center gap-1"><Check size={12} />mentve</span>}
                  <button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                  <button onClick={() => setOpenId(open ? null : s.id)} className="text-gray-400 shrink-0">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {open && (
                  <div className="p-4 space-y-3 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">A levél neve</label>
                        <input value={s.label} onChange={(e) => patchLocal(s.id, { label: e.target.value })} className={input} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hányadik napra</label>
                        <input type="number" min={0} value={s.offsetDays} onChange={(e) => patchLocal(s.id, { offsetDays: Number(e.target.value) })} className={input} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tárgy</label>
                      <input value={s.subject ?? ''} onChange={(e) => patchLocal(s.id, { subject: e.target.value })} className={input} placeholder="A levél tárgya" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Miről szóljon (útmutató az ügynöknek)</label>
                      <textarea rows={2} value={s.brief ?? ''} onChange={(e) => patchLocal(s.id, { brief: e.target.value })} className={`${input} resize-none`} placeholder="Pl. Ajánljuk fel a 3 ingyenes mintatervet a helyszínhez…" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sablon levélminta (ezt szabja személyre az ügynök)</label>
                      <textarea rows={6} value={s.sampleBody ?? ''} onChange={(e) => patchLocal(s.id, { sampleBody: e.target.value })} className={`${input} resize-none font-mono`} placeholder="Sehr geehrte/r [Anrede] [Nachname], …" />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => save(s)} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700">
                        Mentés
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {steps.length === 0 && <p className="text-sm text-gray-400">Nincs sablon-lépés. Adj hozzá egyet.</p>}
        </div>
      )}
    </div>
  )
}
