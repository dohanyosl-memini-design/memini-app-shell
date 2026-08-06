'use client'

import { useState, useEffect } from 'react'
import { Mail, Target, CheckCircle2, Clock, Bot, User, BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { journalHighlights, type Highlight } from '@/lib/journalHighlights'

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
  facts: unknown
  checkpoints: Checkpoint[]
  lastSavedAt: string | null
  closedAt: string | null
  editedByUser: boolean
}

const TONE: Record<Highlight['tone'], string> = {
  good:    'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn:    'bg-amber-50 text-amber-800 border-amber-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
}

function HighlightChips({ facts }: { facts: unknown }) {
  const items = journalHighlights(facts)
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {items.map((h, i) => (
        <span key={i} className={`text-xs px-2 py-1 rounded-lg border ${TONE[h.tone]}`}>
          {h.icon} {h.label}
        </span>
      ))}
    </div>
  )
}

function Entry({ entry, today }: { entry: JournalEntry; today: boolean }) {
  const d = new Date(`${entry.date}T00:00:00Z`)
  return (
    <article
      className={`rounded-2xl border bg-white ${
        today ? 'border-indigo-300 shadow-sm p-5' : 'border-gray-200 p-4'
      }`}
    >
      {/* Dátum-fejléc — naplószerűen, a nap neve kiemelve */}
      <header className="flex items-baseline gap-2 flex-wrap mb-3">
        <h2 className={`font-serif ${today ? 'text-xl' : 'text-lg'} text-gray-900`}>
          {format(d, 'MMMM d.', { locale: hu })}
        </h2>
        <span className="text-sm text-gray-400">
          {format(d, 'EEEE', { locale: hu })}
          {today && ' · ma'}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {entry.editedByUser && (
            <span className="text-xs text-gray-400 flex items-center gap-1" title="Kézzel szerkesztve">
              <User size={11} />
            </span>
          )}
          {entry.checkpoints?.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1" title={`${entry.checkpoints.length} mentés`}>
              <Bot size={11} /> {entry.checkpoints.length}
            </span>
          )}
          {entry.closedAt ? (
            <CheckCircle2 size={13} className="text-emerald-500" />
          ) : (
            <Clock size={13} className="text-amber-500" />
          )}
        </span>
      </header>

      <HighlightChips facts={entry.facts} />

      {entry.narrative ? (
        <div className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-line font-serif">
          {entry.narrative}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          Ehhez a naphoz csak tényadatok vannak mentve — a nap nem lett lezárva.
        </p>
      )}

      {entry.emailDigest?.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-1.5">
            <Mail size={12} /> Levelek
            {entry.emailSource && (
              <span className="font-normal text-gray-400">
                ({entry.emailSource === 'agent' ? 'ügynök postafiókja' : 'CRM szinkron'})
              </span>
            )}
          </h3>
          <ul className="space-y-1.5">
            {entry.emailDigest.map((m, i) => (
              <li key={i} className="text-sm pl-3 border-l-2 border-amber-200">
                <span className="font-medium text-gray-800">{m.from ?? '—'}</span>
                {m.subject && <span className="text-gray-500"> · {m.subject}</span>}
                {m.gist && <div className="text-gray-600">{m.gist}</div>}
                {m.action && <div className="text-xs text-blue-600">→ {m.action}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.priorities?.length > 0 && (
        <section className="mt-4 rounded-xl bg-indigo-50/60 border border-indigo-100 p-3">
          <h3 className="text-xs font-semibold text-indigo-700 flex items-center gap-1 mb-1.5">
            <Target size={12} /> Másnapi fókusz
          </h3>
          <ol className="list-decimal list-inside space-y-0.5">
            {entry.priorities.map((p, i) => (
              <li key={i} className="text-sm text-gray-800">{p}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
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
        <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">Még nincs napi napló.</p>
        <p className="text-gray-400 text-xs mt-1">
          Arthur napi futásai töltik fel — a nap tényei, levelei és a másnapi fókuszok.
        </p>
      </div>
    )
  }

  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' }).format(new Date())

  // Hónaponként csoportosítva, hogy hosszabb távon is olvasható maradjon.
  const groups: { label: string; items: JournalEntry[] }[] = []
  for (const e of entries) {
    const label = format(new Date(`${e.date}T00:00:00Z`), 'yyyy. MMMM', { locale: hu })
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }

  return (
    <div className="max-w-3xl space-y-6">
      {groups.map(g => (
        <section key={g.label}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            {g.label}
          </h2>
          <div className="space-y-3">
            {g.items.map(e => (
              <Entry key={e.id} entry={e} today={e.date === todayIso} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
