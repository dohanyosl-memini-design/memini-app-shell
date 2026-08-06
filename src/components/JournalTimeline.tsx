'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, Mail, Target, CheckCircle2, Clock, Bot, User } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface EmailDigestItem {
  from?: string
  subject?: string
  gist?: string
  action?: string
}

interface Checkpoint {
  at: string
  label: string
  note?: string
}

interface JournalEntry {
  id: string
  date: string
  narrative: string | null
  emailDigest: EmailDigestItem[]
  emailSource: string | null
  priorities: string[]
  checkpoints: Checkpoint[]
  lastSavedAt: string | null
  closedAt: string | null
  editedByUser: boolean
}

export default function JournalTimeline() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/journal?limit=60')
      .then(r => (r.ok ? r.json() : []))
      .then((d: JournalEntry[]) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Betöltés...</div>
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-3xl mb-3">📓</p>
        <p className="text-gray-400 text-sm">Még nincs napi napló.</p>
        <p className="text-gray-400 text-xs mt-1">
          Arthur napi futásai töltik fel — a nap tényei, levelei és a másnapi fókuszok.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(entry => (
        <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <CalendarDays size={15} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">
              {format(new Date(`${entry.date}T00:00:00Z`), 'yyyy. MMMM d., EEEE', { locale: hu })}
            </span>
            {entry.closedAt ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle2 size={11} /> lezárva
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Clock size={11} /> nyitott
              </span>
            )}
            {entry.editedByUser && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
                <User size={11} /> szerkesztve
              </span>
            )}
            {entry.checkpoints?.length > 0 && (
              <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                <Bot size={11} /> {entry.checkpoints.length} mentés
              </span>
            )}
          </div>

          {entry.narrative && (
            <p className="text-sm text-gray-700 whitespace-pre-line mb-3">{entry.narrative}</p>
          )}

          {entry.emailDigest?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-1">
                <Mail size={12} /> Levelek
                {entry.emailSource && (
                  <span className="font-normal text-gray-400">
                    ({entry.emailSource === 'agent' ? 'ügynök postafiókja' : 'CRM szinkron'})
                  </span>
                )}
              </p>
              <ul className="space-y-1">
                {entry.emailDigest.map((m, i) => (
                  <li key={i} className="text-sm text-gray-600 pl-3 border-l-2 border-amber-200">
                    <span className="font-medium text-gray-800">{m.from ?? '—'}</span>
                    {m.subject && <span className="text-gray-500"> · {m.subject}</span>}
                    {m.gist && <div className="text-gray-600">{m.gist}</div>}
                    {m.action && <div className="text-xs text-blue-600">→ {m.action}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.priorities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-1">
                <Target size={12} /> Következő nap fókusza
              </p>
              <ol className="list-decimal list-inside space-y-0.5">
                {entry.priorities.map((p, i) => (
                  <li key={i} className="text-sm text-gray-700">{p}</li>
                ))}
              </ol>
            </div>
          )}

          {!entry.narrative && entry.emailDigest?.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              Csak tényadatok mentve — narratíva nélkül (a napot nem zárta le futás).
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
