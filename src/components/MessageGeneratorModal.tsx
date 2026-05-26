'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Loader2 } from 'lucide-react'

interface MessageGeneratorModalProps {
  templateId: string
  companyId?: string
  contactId?: string
  onClose: () => void
}

interface GenerateResponse {
  text: string
  template: {
    id: string
    name: string
    subject: string | null
    typeLabel: string
  }
}

export default function MessageGeneratorModal({
  templateId,
  companyId,
  contactId,
  onClose,
}: MessageGeneratorModalProps) {
  const [generating, setGenerating] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [huText, setHuText] = useState('')
  const [deText, setDeText] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateType, setTemplateType] = useState('')
  const [subject, setSubject] = useState<string | null>(null)
  const [copiedHu, setCopiedHu] = useState(false)
  const [copiedDe, setCopiedDe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function generate() {
      setGenerating(true)
      setError(null)
      try {
        const res = await fetch('/api/generate-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, companyId, contactId }),
        })
        if (!res.ok) {
          const err = await res.json() as { error?: string }
          setError(err.error ?? 'Hiba történt')
          return
        }
        const data = await res.json() as GenerateResponse
        setHuText(data.text)
        setTemplateName(data.template.name)
        setTemplateType(data.template.typeLabel)
        setSubject(data.template.subject)
      } catch {
        setError('Hálózati hiba')
      } finally {
        setGenerating(false)
      }
    }
    generate()
  }, [templateId, companyId, contactId])

  async function handleTranslate() {
    if (!huText || translating) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: huText, targetLang: 'DE' }),
      })
      if (res.ok) {
        const data = await res.json() as { translated: string }
        setDeText(data.translated)
      }
    } finally {
      setTranslating(false)
    }
  }

  async function copyToClipboard(text: string, isHu: boolean) {
    await navigator.clipboard.writeText(text)
    if (isHu) {
      setCopiedHu(true)
      setTimeout(() => setCopiedHu(false), 2000)
    } else {
      setCopiedDe(true)
      setTimeout(() => setCopiedDe(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{templateName || 'Üzenet generálása'}</h2>
            {templateType && (
              <p className="text-xs text-gray-500 mt-0.5">{templateType}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Hungarian panel */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">🇭🇺 Magyar</span>
                    {generating && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  </div>
                  <button
                    onClick={() => copyToClipboard(huText, true)}
                    disabled={!huText || generating}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                  >
                    {copiedHu ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copiedHu ? 'Másolva' : 'Másolás'}
                  </button>
                </div>

                {subject !== null && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tárgy</label>
                    <input
                      type="text"
                      value={subject ?? ''}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tárgy..."
                    />
                  </div>
                )}

                <textarea
                  value={generating ? '' : huText}
                  onChange={e => setHuText(e.target.value)}
                  placeholder={generating ? 'Generálás...' : 'Szöveg...'}
                  disabled={generating}
                  rows={14}
                  className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {/* German panel */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">🇩🇪 Német</span>
                  <button
                    onClick={() => copyToClipboard(deText, false)}
                    disabled={!deText || translating}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                  >
                    {copiedDe ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copiedDe ? 'Másolva' : 'Másolás'}
                  </button>
                </div>

                {subject !== null && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>
                    <div className="h-9" />
                  </div>
                )}

                <textarea
                  value={deText}
                  onChange={e => setDeText(e.target.value)}
                  placeholder={translating ? 'Fordítás...' : deText ? '' : 'Kattints a "Fordítás németre" gombra...'}
                  disabled={translating}
                  rows={14}
                  className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Bezárás
          </button>
          <button
            onClick={handleTranslate}
            disabled={!huText || generating || translating}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {translating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Fordítás...
              </>
            ) : (
              '🇩🇪 Fordítás németre'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
