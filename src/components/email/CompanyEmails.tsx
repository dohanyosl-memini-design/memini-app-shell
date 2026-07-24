'use client'

import { useEffect, useState } from 'react'
import { Mail, Bot, Loader2, ArrowUpRight } from 'lucide-react'
import EmailConversation from './EmailConversation'
import { REPLY_STATUS, fmtWhen, type ThreadListItem, type ThreadListResponse } from './emailTypes'

// A partner-oldal "Levelezés" fülének tartalma. Ugyanaz az EmailConversation
// komponens fut, mint a Levelek fülön — egy levél, két nézet, egy adatbázis.
export default function CompanyEmails({ companyId }: { companyId: string }) {
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`/api/emails?companyId=${companyId}&status=all`)
      .then(r => r.json())
      .then((d: ThreadListResponse) => {
        setThreads(d.threads)
        setActiveId(prev => prev && d.threads.some(t => t.id === prev) ? prev : d.threads[0]?.id ?? null)
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId])

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-slate-400">
      <Loader2 className="animate-spin" size={20} />
    </div>
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2 text-center px-6">
        <Mail size={24} />
        <p className="text-sm">Ezzel a partnerrel még nincs indexelt levélváltás.</p>
        <p className="text-xs">Amint az IMAP-szinkron behúzza a leveleket, itt jelennek meg — a Levelek fülön is.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{threads.length} levélszál ezzel a partnerrel</p>
        <a href="/emails" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Teljes postafiók <ArrowUpRight size={12} />
        </a>
      </div>

      {/* Szálválasztó */}
      <div className="flex flex-wrap gap-1.5">
        {threads.map(t => {
          const st = REPLY_STATUS[t.replyStatus] ?? REPLY_STATUS.reply_later
          const active = t.id === activeId
          return (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`text-left px-3 py-2 rounded-lg border text-sm max-w-full transition-colors ${
                active
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[220px]">{t.subject}</span>
                {t.hasAgentDraft && <Bot size={12} className="text-blue-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{fmtWhen(t.lastMessageAt)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Kiválasztott szál */}
      {activeId && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <EmailConversation threadId={activeId} onChanged={load} />
        </div>
      )}
    </div>
  )
}
