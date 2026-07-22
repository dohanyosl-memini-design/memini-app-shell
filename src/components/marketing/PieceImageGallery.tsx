'use client'

import { useState, useRef } from 'react'
import { ImagePlus, Star, Trash2, Download, Type, X, Loader2 } from 'lucide-react'
import { LANGUAGES } from '@/lib/marketingConstants'

export interface PieceImage {
  id: string
  url: string
  isPrimary: boolean
  altDe: string | null
  altHu: string | null
  altEn: string | null
  width: number | null
  height: number | null
  bytes: number | null
}

export default function PieceImageGallery({ pieceId, images, onChange }: {
  pieceId: string
  images: PieceImage[]
  onChange: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [altOpen, setAltOpen] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setError(null)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/marketing/pieces/${pieceId}/images`, { method: 'POST', body: fd })
      if (!res.ok) { setError((await res.json().catch(() => null))?.error || 'Feltöltés sikertelen.') }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    onChange()
  }

  async function setPrimary(id: string) {
    await fetch(`/api/marketing/images/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ makePrimary: true }) })
    onChange()
  }
  async function remove(id: string) {
    if (!confirm('Törlöd ezt a képet?')) return
    await fetch(`/api/marketing/images/${id}`, { method: 'DELETE' })
    onChange()
  }
  async function saveAlt(id: string, alt: { altDe: string; altHu: string; altEn: string }) {
    await fetch(`/api/marketing/images/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alt) })
    setAltOpen(null)
    onChange()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ImagePlus size={13} className="text-gray-400" /> Képek ({images.length})</h3>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          {uploading ? 'Feltöltés…' : 'Kép feltöltése'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={e => handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {images.length === 0 ? (
        <p className="text-xs text-gray-400">Tölts fel képet (JPEG/PNG/HEIC) — automatikusan WebP-be konvertálódik a kisebb méretért. Az első kép lesz a borító.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div key={img.id} className="group relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.altHu || img.altDe || ''} className="w-full aspect-square object-cover" />
              {img.isPrimary && (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-600 text-white"><Star size={9} /> Borító</span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-around py-1.5">
                {!img.isPrimary && <button onClick={() => setPrimary(img.id)} title="Borítóként" className="text-white/90 hover:text-white"><Star size={14} /></button>}
                <button onClick={() => setAltOpen(altOpen === img.id ? null : img.id)} title="Alt-szöveg" className="text-white/90 hover:text-white"><Type size={14} /></button>
                <a href={`/api/marketing/images/${img.id}/jpeg`} title="Letöltés JPEG-ként" className="text-white/90 hover:text-white"><Download size={14} /></a>
                <button onClick={() => remove(img.id)} title="Törlés" className="text-white/90 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
              {img.bytes && <span className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0.5 rounded bg-black/50 text-white">{Math.round(img.bytes / 1024)} KB</span>}

              {altOpen === img.id && <AltEditor img={img} onSave={saveAlt} onClose={() => setAltOpen(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AltEditor({ img, onSave, onClose }: { img: PieceImage; onSave: (id: string, alt: { altDe: string; altHu: string; altEn: string }) => void; onClose: () => void }) {
  const [alt, setAlt] = useState({ altDe: img.altDe || '', altHu: img.altHu || '', altEn: img.altEn || '' })
  return (
    <div className="absolute inset-0 bg-white p-2.5 flex flex-col gap-1.5 z-10">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-600">Alt-szöveg</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
      {LANGUAGES.map(l => (
        <input key={l.key} type="text" value={alt[`alt${l.key.charAt(0).toUpperCase() + l.key.slice(1)}` as 'altDe']}
          onChange={e => setAlt({ ...alt, [`alt${l.key.charAt(0).toUpperCase() + l.key.slice(1)}`]: e.target.value })}
          placeholder={l.label}
          className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-violet-400" />
      ))}
      <button onClick={() => onSave(img.id, alt)} className="mt-auto text-[11px] px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700">Mentés</button>
    </div>
  )
}
