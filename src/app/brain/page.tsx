'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Search, Plus, X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import JournalTimeline from '@/components/JournalTimeline'
import WeeklyTrend from '@/components/WeeklyTrend'

interface KnowledgeHit {
  scope: 'brain' | 'memory' | 'activity' | 'email'
  id: string
  kind: string
  title: string
  snippet: string
  date: string | null
  status: string | null
  companyId: string | null
  companyName: string | null
}

interface Company { id: string; name: string }

const SCOPE_META: Record<string, { label: string; color: string }> = {
  brain:    { label: 'Tudás',     color: 'bg-indigo-100 text-indigo-700' },
  memory:   { label: 'Memória',   color: 'bg-blue-100 text-blue-700' },
  activity: { label: 'Aktivitás', color: 'bg-green-100 text-green-700' },
  email:    { label: 'Levél',     color: 'bg-amber-100 text-amber-700' },
}

const KIND_META: Record<string, { label: string; icon: string }> = {
  decision:  { label: 'Döntés',      icon: '⚖️' },
  learning:  { label: 'Tanulság',    icon: '🎓' },
  idea:      { label: 'Ötlet',       icon: '💡' },
  open_loop: { label: 'Nyitott ügy', icon: '🔗' },
  setback:   { label: 'Kudarc',      icon: '🩹' },
}

const STATUS_LABEL: Record<string, string> = {
  active: 'érvényben', superseded: 'felülírva', reverted: 'visszavonva', archived: 'archivált',
  new: 'új', exploring: 'vizsgálat alatt', accepted: 'elfogadva', rejected: 'elvetve', parked: 'későbbre téve',
  open: 'nyitott', closed: 'lezárva',
  recorded: 'rögzítve', lesson_drawn: 'tanulság levonva',
}

/** A ts_headline `**...**` közé teszi a talált szavakat — itt lesz belőle kiemelés. */
function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export default function BrainPage() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<string>('')
  const [kind, setKind] = useState<string>('')
  const [hits, setHits] = useState<KnowledgeHit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [view, setView] = useState<'knowledge' | 'journal' | 'trend'>('knowledge')

  const [form, setForm] = useState({
    kind: 'decision', title: '', content: '', reason: '', nextAction: '',
    reusableRule: '', cause: '', companyId: '',
  })

  const runSearch = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ search: '1', limit: '50' })
    if (query.trim()) p.set('query', query.trim())
    if (scope) p.append('scope', scope)
    if (kind) p.set('kind', kind)
    const res = await fetch(`/api/brain?${p}`)
    if (res.ok) setHits(await res.json())
    setLoading(false)
  }, [query, scope, kind])

  useEffect(() => { runSearch() }, [runSearch])

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then((d: Company[]) => setCompanies(d))
      .catch(() => {})
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    const details: Record<string, string> = {}
    if (form.kind === 'decision'  && form.reason)       details.reason = form.reason
    if (form.kind === 'learning'  && form.reusableRule) details.reusableRule = form.reusableRule
    if (form.kind === 'open_loop' && form.nextAction)   details.nextAction = form.nextAction
    if (form.kind === 'setback'   && form.cause)        details.cause = form.cause

    await fetch('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: form.kind,
        title: form.title.trim(),
        content: form.content.trim() || form.title.trim(),
        details,
        companyId: form.companyId || undefined,
      }),
    })
    setForm(f => ({ ...f, title: '', content: '', reason: '', nextAction: '', reusableRule: '', cause: '' }))
    setShowForm(false)
    runSearch()
  }

  async function handleDelete(id: string) {
    if (!confirm('Törli ezt a bejegyzést?')) return
    await fetch(`/api/brain/${id}`, { method: 'DELETE' })
    runSearch()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={22} className="text-indigo-600" />
            Memini Brain
          </h1>
          <p className="text-gray-500 mt-1">
            A cég tudása egy helyen: döntések és indokaik, tanulságok, kudarcok, ötletek, nyitott ügyek — plusz a memóriák, aktivitások és levelek.
          </p>
        </div>
        {view === 'knowledge' && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} /> Új bejegyzés
          </button>
        )}
      </div>

      {/* Nézetváltó: hosszú távú tudás vs. napi napló */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 mb-4">
        {([
          ['knowledge', '🧠 Tudás'],
          ['journal',   '📓 Napi napló'],
          ['trend',     '📈 Heti trend'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'journal' && <JournalTimeline />}
      {view === 'trend' && <WeeklyTrend />}

      {view === 'knowledge' && (
      <>
      {/* Kereső */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Keresés kulcsszóra vagy kifejezésre — pl. "éves vállalás" -minta'
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Minden forrás</option>
            <option value="brain">Tudás</option>
            <option value="memory">Memória</option>
            <option value="activity">Aktivitás</option>
            <option value="email">Levél</option>
          </select>
          <select
            value={kind}
            onChange={e => setKind(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Minden típus</option>
            <option value="decision">⚖️ Döntés</option>
            <option value="learning">🎓 Tanulság</option>
            <option value="idea">💡 Ötlet</option>
            <option value="open_loop">🔗 Nyitott ügy</option>
            <option value="setback">🩹 Kudarc</option>
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-2 px-1">
          Idézőjelben pontos kifejezés · mínusszal kizárás · <code>or</code> a vagy-kapcsolathoz
        </p>
      </div>

      {/* Új bejegyzés */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Típus</label>
              <select
                value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="decision">⚖️ Döntés</option>
                <option value="learning">🎓 Tanulság</option>
                <option value="idea">💡 Ötlet</option>
                <option value="open_loop">🔗 Nyitott ügy</option>
                <option value="setback">🩹 Kudarc</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Partner (opcionális)</label>
              <select
                value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">— nincs —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cím *</label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Leírás</label>
            <textarea
              rows={2}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          {form.kind === 'decision' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Miért? — az indok *</label>
              <textarea
                rows={2}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Az érvelés, ami mögötte van — ezt fogod elfelejteni, nem a döntést"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
            </div>
          )}
          {form.kind === 'learning' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Újra alkalmazható szabály</label>
              <textarea
                rows={2}
                value={form.reusableRule}
                onChange={e => setForm(f => ({ ...f, reusableRule: e.target.value }))}
                placeholder="Mit csináljunk legközelebb hasonló helyzetben?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
            </div>
          )}
          {form.kind === 'open_loop' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Következő lépés</label>
              <input
                value={form.nextAction}
                onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}
          {form.kind === 'setback' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mi okozta?</label>
              <textarea
                rows={2}
                value={form.cause}
                onChange={e => setForm(f => ({ ...f, cause: e.target.value }))}
                placeholder="Amennyire látjuk — ebből lesz később a tanulság"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Mégse
            </button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Mentés
            </button>
          </div>
        </form>
      )}

      {/* Találatok */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Keresés...</div>
      ) : hits.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-3xl mb-3">🧠</p>
          <p className="text-gray-400 text-sm">
            {query ? `Nincs találat erre: "${query}"` : 'Még nincs rögzített tudás.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 px-1">{hits.length} találat</p>
          {hits.map(hit => {
            const scopeMeta = SCOPE_META[hit.scope] ?? SCOPE_META.brain
            const kindMeta = KIND_META[hit.kind]
            return (
              <div key={`${hit.scope}-${hit.id}`} className="group bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scopeMeta.color}`}>
                    {scopeMeta.label}
                  </span>
                  {kindMeta && (
                    <span className="text-xs text-gray-500">{kindMeta.icon} {kindMeta.label}</span>
                  )}
                  {hit.companyName && (
                    <a href={`/companies/${hit.companyId}`} className="text-xs text-blue-600 hover:underline">
                      {hit.companyName}
                    </a>
                  )}
                  {hit.status && (
                    <span className="text-xs text-gray-400">{STATUS_LABEL[hit.status] ?? hit.status}</span>
                  )}
                  {hit.date && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {format(new Date(hit.date), 'yyyy. MMM d.', { locale: hu })}
                    </span>
                  )}
                  {hit.scope === 'brain' && (
                    <button
                      onClick={() => handleDelete(hit.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                {/* Memóriánál a "cím" maga a tartalom eleje — ott csak a kiemelt kivonat kell. */}
                {hit.scope !== 'memory' && (
                  <p className="text-sm font-medium text-gray-900">{hit.title}</p>
                )}
                <p className="text-sm text-gray-600 mt-0.5">
                  <Highlighted text={hit.snippet} />
                </p>
              </div>
            )
          })}
        </div>
      )}
      </>
      )}
    </div>
  )
}
