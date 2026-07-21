'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CHANNELS, channelInfo, PIECE_STATUS_LABELS } from '@/lib/marketingConstants'

interface LibPiece {
  id: string; title: string; channel: string; status: string; source: string
  scheduledFor: string | null
  theme: { id: string; title: string } | null
  parentPiece: { id: string; channel: string } | null
  bodyDe: string | null; bodyHu: string | null; bodyEn: string | null
}

export default function ContentLibrary() {
  const [pieces, setPieces] = useState<LibPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (channel !== 'all') params.set('channel', channel)
    if (status !== 'all') params.set('status', status)
    const data = await (await fetch(`/api/marketing/pieces?${params}`)).json()
    setPieces(data); setLoading(false)
  }, [channel, status])

  useEffect(() => { load() }, [load])

  function langDots(p: LibPiece) {
    return [['de', p.bodyDe], ['hu', p.bodyHu], ['en', p.bodyEn]] as const
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={channel} onChange={e => setChannel(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="all">Minden csatorna</option>
          {CHANNELS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="all">Minden státusz</option>
          {Object.entries(PIECE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Betöltés...</div>
      ) : pieces.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">Nincs tartalom ezekkel a szűrőkkel.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pieces.map(p => {
            const ci = channelInfo(p.channel)
            const st = PIECE_STATUS_LABELS[p.status]
            return (
              <Link key={p.id} href={`/marketing/piece/${p.id}`} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ci?.color ?? 'bg-gray-100'}`}>{ci?.icon} {ci?.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st?.color}`}>{st?.label}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{p.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-0.5">
                    {langDots(p).map(([lang, body]) => (
                      <span key={lang} className={`px-1 rounded ${body ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-300'}`}>{lang.toUpperCase()}</span>
                    ))}
                  </span>
                  {p.theme && <span className="truncate">· {p.theme.title}</span>}
                  {p.scheduledFor && <span className="ml-auto shrink-0">{new Date(p.scheduledFor).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
