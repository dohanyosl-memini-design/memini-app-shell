'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Trash2, Sparkles, Languages, GitBranch,
  Calendar, History, ExternalLink, Wand2,
} from 'lucide-react'
import Modal from '@/components/Modal'
import PieceForm from '@/components/marketing/PieceForm'
import { CHANNELS, CHANNEL_KEYS, channelInfo, LANGUAGES, PIECE_STATUS_LABELS } from '@/lib/marketingConstants'

interface DerivedPiece { id: string; title: string; channel: string; status: string }
interface PieceEvent { id: string; actor: string; action: string; field: string | null; createdAt: string }

interface Piece {
  id: string
  title: string
  channel: string
  bodyDe: string | null
  bodyHu: string | null
  bodyEn: string | null
  slug: string | null
  status: string
  source: string
  scheduledFor: string | null
  publishedAt: string | null
  theme: { id: string; title: string; message: string | null; outline: string | null } | null
  arc: { id: string; title: string; level: string } | null
  parentPiece: { id: string; title: string; channel: string; bodyDe: string | null } | null
  derivedPieces: DerivedPiece[]
  events: PieceEvent[]
}

const BODY_FIELD: Record<string, 'bodyDe' | 'bodyHu' | 'bodyEn'> = { de: 'bodyDe', hu: 'bodyHu', en: 'bodyEn' }

export default function PieceEditorPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [piece, setPiece] = useState<Piece | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genLang, setGenLang] = useState<string | null>(null)
  const [deriveModal, setDeriveModal] = useState(false)

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('draft')
  const [scheduledFor, setScheduledFor] = useState('')
  const [slug, setSlug] = useState('')
  const [bodies, setBodies] = useState<Record<string, string>>({ de: '', hu: '', en: '' })

  const load = useCallback(() => {
    fetch(`/api/marketing/pieces/${id}`).then(r => r.json()).then((p: Piece) => {
      setPiece(p)
      setTitle(p.title)
      setStatus(p.status)
      setScheduledFor(p.scheduledFor ? p.scheduledFor.slice(0, 10) : '')
      setSlug(p.slug || '')
      setBodies({ de: p.bodyDe || '', hu: p.bodyHu || '', en: p.bodyEn || '' })
      setLoading(false)
    })
  }, [id])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await fetch(`/api/marketing/pieces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, status, slug,
        scheduledFor: scheduledFor || null,
        bodyDe: bodies.de, bodyHu: bodies.hu, bodyEn: bodies.en,
      }),
    })
    setSaving(false)
    load()
  }

  async function handleDelete() {
    if (!confirm('Biztosan törlöd ezt a tartalmat?')) return
    await fetch(`/api/marketing/pieces/${id}`, { method: 'DELETE' })
    router.push('/marketing')
  }

  // Generálás forrása: szülő-tartalom (származtatásnál) → téma vázlat/üzenet → cím.
  function generationSource(): string {
    if (piece?.parentPiece?.bodyDe) return piece.parentPiece.bodyDe
    if (piece?.theme) return [piece.theme.message, piece.theme.outline].filter(Boolean).join('\n\n') || piece.theme.title
    return title
  }

  async function generate(lang: string, mode: 'generate' | 'localize') {
    if (!piece) return
    setGenLang(lang)
    const source = mode === 'localize' ? bodies.de : generationSource()
    if (!source.trim()) { setGenLang(null); alert(mode === 'localize' ? 'Előbb a német törzsszöveg kell.' : 'Nincs forrás a generáláshoz (cím, téma vagy szülő-tartalom).'); return }
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, channel: piece.channel, language: lang, sourceText: source, title }),
      })
      const data = await res.json()
      if (res.ok && data.text) {
        setBodies(prev => ({ ...prev, [lang]: data.text }))
        // Azonnal mentjük az adott mezőt + naplózzuk.
        await fetch(`/api/marketing/pieces/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: BODY_FIELD[lang], value: data.text, action: mode === 'localize' ? 'localized' : 'updated' }),
        })
      } else {
        alert(data.error || 'Generálás sikertelen.')
      }
    } finally {
      setGenLang(null)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Betöltés...</div>
  if (!piece) return <div className="p-6 text-center text-gray-400">Tartalom nem található.</div>

  const ch = channelInfo(piece.channel)
  const st = PIECE_STATUS_LABELS[status]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button onClick={() => router.push('/marketing')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm">
          <ArrowLeft size={16} /> Marketing
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={15} /></button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm">
            <Save size={15} /> {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>

      {/* Cím + meta */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {ch && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ch.color}`}>{ch.icon} {ch.label}</span>}
          {piece.source !== 'human' && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">🤖 {piece.source === 'agent' ? 'Agent' : 'Automatizáció'}</span>}
          {piece.theme && <Link href="/marketing" className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">Téma: {piece.theme.title}</Link>}
          {piece.parentPiece && (
            <Link href={`/marketing/piece/${piece.parentPiece.id}`} className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center gap-1">
              <GitBranch size={10} /> {channelInfo(piece.parentPiece.channel)?.label ?? piece.parentPiece.channel}-ból
            </Link>
          )}
        </div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full text-xl font-bold text-gray-900 border-0 border-b border-transparent focus:border-gray-200 focus:outline-none pb-1 mb-3" />
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Státusz</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="draft">Piszkozat</option>
              <option value="ready">Kész (jóváhagyva)</option>
              <option value="scheduled">Ütemezett</option>
              <option value="published">Publikált</option>
              <option value="archived">Archivált</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ütemezés</label>
            <input type="date" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          {piece.channel === 'blog' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">URL-slug (weboldal)</label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="ulmi-dom-reszletek"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          )}
        </div>
      </div>

      {/* Három nyelv */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {LANGUAGES.map(lang => (
          <div key={lang.key} className={`bg-white rounded-2xl border shadow-sm p-4 ${lang.primary ? 'border-violet-200' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                {lang.label}
                {lang.primary && <span className="text-[10px] px-1.5 py-0 rounded-full bg-violet-100 text-violet-700">elsődleges</span>}
              </span>
              <button
                onClick={() => generate(lang.key, lang.primary ? 'generate' : 'localize')}
                disabled={genLang !== null}
                title={lang.primary ? 'Generálás a forrásból' : 'Lokalizálás a német szövegből'}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors"
              >
                {genLang === lang.key ? <Wand2 size={12} className="animate-pulse" /> : lang.primary ? <Sparkles size={12} /> : <Languages size={12} />}
                {genLang === lang.key ? 'Generálás…' : lang.primary ? 'Generálás' : 'Lokalizálás'}
              </button>
            </div>
            <textarea
              rows={16}
              value={bodies[lang.key]}
              onChange={e => setBodies(prev => ({ ...prev, [lang.key]: e.target.value }))}
              placeholder={lang.primary ? 'Német törzsszöveg — ez a forrás a lokalizációhoz…' : `${lang.label} — „Lokalizálás" a német szövegből, vagy írd kézzel…`}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        ))}
      </div>

      {/* Származtatás */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><GitBranch size={13} className="text-gray-400" /> Származtatott tartalmak</h3>
          <button onClick={() => setDeriveModal(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100">
            <Sparkles size={12} /> Új tartalom ebből
          </button>
        </div>
        {piece.derivedPieces.length === 0 ? (
          <p className="text-xs text-gray-400">Ebből a tartalomból még nem származott másik. Pörgesd ki belőle a LinkedIn-posztot, Instát, hírlevelet — a generálás a német törzset használja forrásként.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {piece.derivedPieces.map(d => {
              const dch = channelInfo(d.channel)
              return (
                <Link key={d.id} href={`/marketing/piece/${d.id}`} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${dch?.color ?? 'bg-gray-50'} hover:opacity-80`}>
                  {dch?.icon} {d.title.length > 30 ? d.title.slice(0, 28) + '…' : d.title}
                  <ExternalLink size={10} />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Előzmények */}
      {piece.events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><History size={13} className="text-gray-400" /> Előzmények</h3>
          <div className="space-y-1.5">
            {piece.events.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-2.5 text-xs">
                <span className="text-gray-400 w-[92px] font-mono shrink-0">{new Date(e.createdAt).toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`shrink-0 px-1.5 py-0 rounded-full font-medium ${e.actor === 'agent' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>{e.actor}</span>
                <span className="text-gray-600">{e.action}{e.field ? ` · ${e.field}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {deriveModal && (
        <Modal title="Új tartalom ebből származtatva" onClose={() => setDeriveModal(false)} size="lg">
          <PieceForm
            parentPieceId={piece.id}
            defaultThemeId={piece.theme?.id}
            defaultChannel={CHANNEL_KEYS.find(c => c !== piece.channel)}
            onSave={(newId) => { setDeriveModal(false); router.push(`/marketing/piece/${newId}`) }}
            onCancel={() => setDeriveModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
