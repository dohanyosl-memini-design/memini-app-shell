'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Check, RotateCcw } from 'lucide-react'
import { CONTRACT_TOKENS } from '@/lib/assetContractDefault'

export default function AssetContractTemplateSection() {
  const [titleDe, setTitleDe] = useState('')
  const [bodyDe, setBodyDe] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchTpl = useCallback(async () => {
    const res = await fetch('/api/asset-contract-template')
    if (res.ok) {
      const data = await res.json() as { titleDe: string; bodyDe: string }
      setTitleDe(data.titleDe)
      setBodyDe(data.bodyDe)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTpl() }, [fetchTpl])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/asset-contract-template', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleDe, bodyDe }),
    })
    setSaving(false)
    if (res.ok) {
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  function insertToken(token: string) {
    setBodyDe(b => b + token)
    setDirty(true)
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Szerződéssablon (német)</h3>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {saved ? <Check size={12} /> : null}
          {saving ? 'Mentés...' : saved ? 'Elmentve!' : 'Mentés'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        A német alapszöveg, amiből minden átadási szerződés készül. A <code className="text-gray-500">{'{{...}}'}</code> tokeneket a rendszer generáláskor tölti ki a partner adataival és a kipipált eszközökkel. A módosítás csak a jövőbeli szerződésekre hat — a már kiment/aláírt példányok változatlanok maradnak.
      </p>

      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">A dokumentum címe</label>
        <input
          value={titleDe}
          onChange={e => { setTitleDe(e.target.value); setDirty(true) }}
          placeholder="Leihvertrag"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {/* token-paletta */}
      <div className="mb-2">
        <div className="text-xs text-gray-500 mb-1.5">Beszúrható tokenek (kattints a szöveg végére illesztéshez):</div>
        <div className="flex flex-wrap gap-1.5">
          {CONTRACT_TOKENS.map(t => (
            <button
              key={t.token}
              type="button"
              onClick={() => insertToken(t.token)}
              title={t.label}
              className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {t.token}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs text-gray-500 mb-1">A szerződés szövege</label>
      <textarea
        value={bodyDe}
        onChange={e => { setBodyDe(e.target.value); setDirty(true) }}
        rows={22}
        spellCheck={false}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono leading-relaxed"
        placeholder="Ide illeszd be / írd meg a német alap-szerződésszöveget, tokenekkel."
      />

      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <RotateCcw size={13} className="mt-0.5 shrink-0" />
          <div>
            A <code className="font-mono">{'{{Geräteliste}}'}</code> helyére generáláskor az átadás kipipált tételei kerülnek (típus, darab, érték), és utánuk a kellékekhez tartozó szerződés-kiegészítések. Az egyszeri alap-kitöltés után a szöveg bármikor módosítható.
          </div>
        </div>
      </div>
    </div>
  )
}
