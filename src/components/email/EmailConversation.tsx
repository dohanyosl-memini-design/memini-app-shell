'use client'

import { useEffect, useState } from 'react'
import { Paperclip, Send, Pencil, Trash2, Bot, Loader2 } from 'lucide-react'
import { REPLY_STATUS, fmtWhen, type ThreadDetail } from './emailTypes'

// Egy teljes levélszál megjelenítése + a tervezetek jóváhagyó felülete.
// Újrahasznosítható: a Levelek fül jobb paneljében ÉS a partner-oldal
// Levelezés szakaszában is ugyanez a komponens fut.
export default function EmailConversation({
  threadId,
  onChanged,
}: {
  threadId: string
  onChanged?: () => void
}) {
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/emails/${threadId}`)
      .then(r => r.json())
      .then(d => setThread(d.error ? null : d))
      .finally(() => setLoading(false))
  }
  useEffect(load, [threadId])

  const draftAction = async (id: string, action: 'approve' | 'discard') => {
    setBusy(id)
    await fetch(`/api/emails/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(null)
    load()
    onChanged?.()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <Loader2 className="animate-spin" size={20} />
    </div>
  }
  if (!thread) {
    return <div className="p-6 text-slate-400 text-sm">A levélszál nem tölthető be.</div>
  }

  const status = REPLY_STATUS[thread.replyStatus] ?? REPLY_STATUS.reply_later

  return (
    <div className="flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex-1 text-balance">
            {thread.subject}
          </h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${status.cls}`}>
            {status.label}
          </span>
        </div>
        {thread.company && (
          <a
            href={`/companies/${thread.company.id}`}
            className="inline-flex items-center gap-2 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {thread.company.name}
            {thread.company.city ? <span className="text-slate-400">· {thread.company.city}</span> : null}
          </a>
        )}
      </div>

      <div className="px-5">
        {thread.emails.map(m => {
          const out = m.direction === 'outbound'
          const from = m.participants.find(p => p.type === 'from')
          return (
            <div key={m.id} className="py-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-2 text-sm mb-1.5">
                <span className={`font-semibold ${out ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                  {from?.displayName || from?.emailAddress || (out ? 'Mi' : 'Partner')}
                </span>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400">
                  {out ? 'kimenő' : 'bejövő'}
                </span>
                <span className="ml-auto text-xs text-slate-400 tabular-nums">{fmtWhen(m.sentAt)}</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {m.textBody}
              </div>
              {m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.attachments.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                      <Paperclip size={12} /> {a.filename}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tervezetek — a jóváhagyó felület */}
      {thread.drafts.map(d => (
        <div key={d.id} className="m-5 rounded-xl border border-blue-300 dark:border-blue-700 overflow-hidden bg-blue-50/60 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800">
            {d.source === 'agent' ? <Bot size={15} className="text-blue-600 dark:text-blue-400" /> : <Pencil size={15} className="text-slate-500" />}
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {d.source === 'agent' ? 'Agent által előkészített válasz' : 'Tervezet'}
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {d.status === 'approved' ? 'Jóváhagyva · küldésre vár' : d.status === 'failed' ? 'Küldési hiba' : 'Jóváhagyásra vár'}
            </span>
          </div>
          <div className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
            {d.bodyText}
          </div>
          {d.sendError && <div className="px-4 pb-2 text-xs text-red-500">{d.sendError}</div>}
          {d.status !== 'approved' && (
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              <button
                onClick={() => draftAction(d.id, 'approve')}
                disabled={busy === d.id}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Jóváhagyás (küldésre)
              </button>
              <button
                onClick={() => draftAction(d.id, 'discard')}
                disabled={busy === d.id}
                className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Trash2 size={14} /> Eldobás
              </button>
            </div>
          )}
        </div>
      ))}

      <p className="px-5 pb-5 text-xs text-slate-400">
        A tényleges kiküldés a következő szeletben (SMTP-bekötés) kapcsol be — a jóváhagyás
        addig sorba állítja a levelet, de nem küldi el.
      </p>
    </div>
  )
}
