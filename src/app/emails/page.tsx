'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Bot, Loader2, Inbox } from 'lucide-react'
import EmailConversation from '@/components/email/EmailConversation'
import {
  REPLY_STATUS, fmtWhen,
  type ThreadListItem, type ThreadListResponse,
} from '@/components/email/emailTypes'

const FILTERS: { key: string; label: string }[] = [
  { key: 'unanswered', label: 'Válaszra vár' },
  { key: 'inbox', label: 'Beszélgetések' },
  { key: 'answered', label: 'Válaszolt' },
  { key: 'automated', label: 'Automata / hírlevél' },
  { key: 'spam', label: 'Spam' },
]

export default function EmailsPage() {
  const [filter, setFilter] = useState('unanswered')
  const [search, setSearch] = useState('')
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [unanswered, setUnanswered] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ status: filter, ...(search ? { search } : {}) })
    fetch(`/api/emails?${qs}`)
      .then(r => r.json())
      .then((d: ThreadListResponse) => {
        setThreads(d.threads)
        setUnanswered(d.unansweredCount)
        setActiveId(prev => prev && d.threads.some(t => t.id === prev) ? prev : d.threads[0]?.id ?? null)
      })
      .finally(() => setLoading(false))
  }, [filter, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <Mail className="text-blue-600 dark:text-blue-400" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Levelek</h1>
          <p className="text-slate-500 text-sm">
            {unanswered} szál vár válaszra
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        {/* Lista */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    filter === f.key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}{f.key === 'unanswered' && unanswered ? ` · ${unanswered}` : ''}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Keresés a levelekben…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent dark:text-white placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 px-6 text-center">
                <Inbox size={26} />
                <p className="text-sm">Nincs levél ebben a nézetben.</p>
                <p className="text-xs">Futtasd a seedet vagy kösd be az IMAP-szinkront, hogy leveleket láss itt.</p>
              </div>
            ) : threads.map(t => {
              const st = REPLY_STATUS[t.replyStatus] ?? REPLY_STATUS.reply_later
              const active = t.id === activeId
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 border-l-[3px] transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500'
                      : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {t.sender}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                      {fmtWhen(t.lastMessageAt)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.subject}</div>
                  <div className="text-xs text-slate-500 truncate">{t.snippet}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {t.hasAgentDraft && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        <Bot size={11} /> Agent tervezet
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Olvasó */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden min-h-[300px]">
          {activeId ? (
            <EmailConversation threadId={activeId} onChanged={load} />
          ) : (
            <div className="flex items-center justify-center h-72 text-slate-400 text-sm">
              Válassz egy levélszálat a listából.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
