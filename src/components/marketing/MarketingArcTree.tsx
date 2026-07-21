'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Plus, Edit2, Trash2, Archive, ChevronRight, ChevronDown,
  Layers, Gauge, Sparkles, FileText, Lightbulb,
} from 'lucide-react'
import Modal from '@/components/Modal'
import ArcForm from '@/components/marketing/ArcForm'
import ThemeForm from '@/components/marketing/ThemeForm'
import PieceForm from '@/components/marketing/PieceForm'
import { useRouter } from 'next/navigation'
import { ARC_LEVEL_LABELS, ARC_STATUS_LABELS, THEME_STATUS_LABELS, channelInfo, arcPeriodLabel } from '@/lib/marketingConstants'

interface Fill { planned: number; actual: number; percent: number | null }
interface ArcNode {
  id: string; title: string; description: string | null; level: string
  year: number | null; quarter: number | null; month: number | null
  status: string; strategicArea: string | null; cadenceMap: Record<string, number>
  goalId: string | null; parentId: string | null
  fill: Fill; themeCount: number; pieceCount: number; children: ArcNode[]
}
interface ArcTheme { id: string; title: string; message: string | null; status: string; _count?: { pieces: number } }
interface ArcPiece { id: string; title: string; channel: string; status: string; scheduledFor: string | null }
interface ArcDetail extends ArcNode { themes: ArcTheme[]; pieces: ArcPiece[] }

const LEVEL_DOT: Record<string, string> = { vision: 'bg-purple-500', yearly: 'bg-violet-500', quarterly: 'bg-fuchsia-500', monthly: 'bg-pink-500' }
const NEXT_LEVEL: Record<string, string | null> = { vision: 'yearly', yearly: 'quarterly', quarterly: 'monthly', monthly: null }

function isCurrent(n: ArcNode): boolean {
  const now = new Date(), y = now.getFullYear()
  if (n.level === 'yearly') return n.year === y
  if (n.level === 'quarterly') return n.year === y && n.quarter === Math.floor(now.getMonth() / 3) + 1
  if (n.level === 'monthly') return n.year === y && n.month === now.getMonth() + 1
  return false
}

function flatten(nodes: ArcNode[]): ArcNode[] {
  const out: ArcNode[] = []
  const walk = (ns: ArcNode[]) => { for (const n of ns) { out.push(n); walk(n.children) } }
  walk(nodes); return out
}

function pickDefault(nodes: ArcNode[]): string | null {
  const flat = flatten(nodes)
  if (!flat.length) return null
  const now = new Date(), y = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1, m = now.getMonth() + 1
  const rank = (n: ArcNode) => {
    if (n.level === 'monthly' && n.year === y && n.month === m) return 5
    if (n.level === 'quarterly' && n.year === y && n.quarter === q) return 4
    if (n.level === 'yearly' && n.year === y) return 3
    if (n.level === 'vision') return 2
    return 1
  }
  return flat.reduce((b, n) => (rank(n) > rank(b) ? n : b), flat[0]).id
}

function findNode(nodes: ArcNode[], id: string): ArcNode | null {
  for (const n of nodes) { if (n.id === id) return n; const f = findNode(n.children, id); if (f) return f }
  return null
}

function FillBar({ percent, small }: { percent: number | null; small?: boolean }) {
  if (percent === null) return null
  const color = percent >= 100 ? 'bg-green-500' : percent >= 60 ? 'bg-violet-500' : percent >= 30 ? 'bg-amber-500' : 'bg-red-400'
  return <div className={`w-full bg-gray-100 rounded-full ${small ? 'h-1' : 'h-2'}`}><div className={`${color} ${small ? 'h-1' : 'h-2'} rounded-full transition-all`} style={{ width: `${Math.min(100, percent)}%` }} /></div>
}

function TreeItem({ node, depth, selectedId, expanded, onToggle, onSelect }: {
  node: ArcNode; depth: number; selectedId: string | null
  expanded: Record<string, boolean>; onToggle: (id: string) => void; onSelect: (id: string) => void
}) {
  const isOpen = expanded[node.id] ?? false
  const hasKids = node.children.length > 0
  const period = arcPeriodLabel(node)
  return (
    <div>
      <div onClick={() => onSelect(node.id)}
        className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer transition-colors ${selectedId === node.id ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-gray-50'}`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}>
        {hasKids ? (
          <button onClick={e => { e.stopPropagation(); onToggle(node.id) }} className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5">
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="w-[22px] shrink-0" />}
        <span className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[node.level]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm truncate ${node.status !== 'active' ? 'text-gray-400 line-through' : 'text-gray-800'} ${isCurrent(node) ? 'font-semibold' : ''}`}>{node.title}</span>
            {isCurrent(node) && <span className="shrink-0 text-[10px] px-1.5 py-0 rounded-full bg-pink-100 text-pink-700 font-medium">most</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {period && <span className="text-[10px] text-gray-400 shrink-0">{period}</span>}
            <div className="flex-1 max-w-[110px]"><FillBar percent={node.fill.percent} small /></div>
            {node.fill.percent !== null && <span className="text-[10px] text-gray-400 shrink-0">{Math.round(node.fill.percent)}%</span>}
          </div>
        </div>
      </div>
      {isOpen && node.children.map(c => <TreeItem key={c.id} node={c} depth={depth + 1} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />)}
    </div>
  )
}

export default function MarketingArcTree() {
  const router = useRouter()
  const [tree, setTree] = useState<ArcNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<ArcDetail | null>(null)
  const [arcModal, setArcModal] = useState<{ arc: ArcNode | null; defaultLevel?: string; defaultParentId?: string } | null>(null)
  const [themeModal, setThemeModal] = useState<{ theme: ArcTheme | null; arcId: string } | null>(null)
  const [pieceModal, setPieceModal] = useState<{ arcId?: string; themeId?: string } | null>(null)
  const didInit = useRef(false)

  const fetchTree = useCallback(async () => {
    const data: ArcNode[] = await (await fetch('/api/marketing/tree')).json()
    setTree(data); setLoading(false)
    setExpanded(prev => {
      if (Object.keys(prev).length > 0) return prev
      const open: Record<string, boolean> = {}
      const walk = (ns: ArcNode[], chain: string[]) => { for (const n of ns) { if (isCurrent(n) || n.level === 'vision') { chain.forEach(id => open[id] = true); open[n.id] = true }; walk(n.children, [...chain, n.id]) } }
      walk(data, []); return open
    })
    if (!didInit.current) { didInit.current = true; const d = pickDefault(data); if (d) setSelectedId(d) }
  }, [])

  useEffect(() => { fetchTree() }, [fetchTree])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    fetch(`/api/marketing/arcs/${selectedId}`).then(r => r.json()).then(setDetail)
  }, [selectedId, tree])

  const selected = selectedId ? findNode(tree, selectedId) : null
  const nextLevel = selected ? NEXT_LEVEL[selected.level] : null

  async function handleArchive(arc: ArcNode) {
    if (!confirm(`Archiválod: „${arc.title}"?`)) return
    await fetch(`/api/marketing/arcs/${arc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) })
    if (selectedId === arc.id) setSelectedId(null)
    fetchTree()
  }
  async function handleDelete(arc: ArcNode) {
    if (!confirm(`Véglegesen törlöd: „${arc.title}"? A témák és tartalmak megmaradnak.`)) return
    const res = await fetch(`/api/marketing/arcs/${arc.id}`, { method: 'DELETE' })
    if (!res.ok) { alert((await res.json().catch(() => null))?.error || 'Törlés sikertelen.'); return }
    if (selectedId === arc.id) setSelectedId(null)
    fetchTree()
  }
  function saved() { setArcModal(null); setThemeModal(null); setPieceModal(null); fetchTree(); if (selectedId) fetch(`/api/marketing/arcs/${selectedId}`).then(r => r.json()).then(setDetail) }

  if (loading) return <div className="py-24 text-center text-gray-400">Betöltés...</div>

  return (
    <div className="grid md:grid-cols-[minmax(300px,380px)_1fr] gap-4 items-start">
      {/* Fa */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:sticky md:top-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Layers size={14} className="text-violet-500" /> Marketing-ív</span>
          <button onClick={() => setArcModal({ arc: null, defaultLevel: 'vision' })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100"><Plus size={12} /> Új ív</button>
        </div>
        {tree.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm text-gray-400 mb-2">Még nincs marketing-ív.</p>
            <p className="text-xs text-gray-400">Kezdd a hosszú távú iránnyal, majd bontsd le éves → negyedéves → havi ívekre, kadenciával.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map(n => <TreeItem key={n.id} node={n} depth={0} selectedId={selectedId} expanded={expanded} onToggle={id => setExpanded(p => ({ ...p, [id]: !p[id] }))} onSelect={setSelectedId} />)}
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2 border-t border-gray-50 px-1">
          {Object.entries(ARC_LEVEL_LABELS).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-gray-400"><span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[k]}`} />{label}</span>
          ))}
        </div>
      </div>

      {/* Részletek */}
      {!selected ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4"><Layers size={26} className="text-violet-400" /></div>
          <p className="text-base font-semibold text-gray-700 mb-1">Kezdd a marketing-ívvel</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-5">Add meg a hosszú távú marketing-irányt, bontsd le éves → negyedéves → havi ívekre kadenciával, és tölts fel témákat.</p>
          <button onClick={() => setArcModal({ arc: null, defaultLevel: 'vision' })} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"><Plus size={15} /> Hosszú távú ív</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fejléc */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${LEVEL_DOT[selected.level]}`}>{ARC_LEVEL_LABELS[selected.level]}{arcPeriodLabel(selected) ? ` · ${arcPeriodLabel(selected)}` : ''}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ARC_STATUS_LABELS[selected.status]?.color}`}>{ARC_STATUS_LABELS[selected.status]?.label}</span>
                {selected.strategicArea && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{selected.strategicArea}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setArcModal({ arc: selected })} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Edit2 size={14} /></button>
                <button onClick={() => handleArchive(selected)} className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"><Archive size={14} /></button>
                <button onClick={() => handleDelete(selected)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{selected.title}</h2>
            {selected.description && <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">{selected.description}</p>}

            {/* Telítettség + kadencia */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><Gauge size={12} /> Telítettség {selected.fill.percent !== null ? `(${selected.fill.actual}/${selected.fill.planned} tartalom)` : ''}</span>
                {selected.fill.percent !== null && <span className="text-sm font-bold text-gray-800">{selected.fill.percent}%</span>}
              </div>
              <FillBar percent={selected.fill.percent} />
              {Object.keys(selected.cadenceMap).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(selected.cadenceMap).map(([ch, n]) => {
                    const ci = channelInfo(ch)
                    return <span key={ch} className={`text-[11px] px-2 py-0.5 rounded-full border ${ci?.color ?? 'bg-gray-100'}`}>{ci?.icon} {n}× / hét</span>
                  })}
                </div>
              )}
              {selected.fill.percent === null && Object.keys(selected.cadenceMap).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Adj kadenciát (heti hány tartalom) a telítettség méréséhez, vagy bontsd le al-ívekre.</p>
              )}
            </div>
          </div>

          {/* Al-ívek */}
          {(nextLevel || selected.children.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Layers size={13} className="text-gray-400" /> Al-ívek ({selected.children.length})</h3>
                {nextLevel && <button onClick={() => setArcModal({ arc: null, defaultLevel: nextLevel, defaultParentId: selected.id })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100"><Plus size={12} /> {ARC_LEVEL_LABELS[nextLevel]}</button>}
              </div>
              {selected.children.length === 0 ? (
                <p className="text-xs text-gray-400">{nextLevel ? `Bontsd le ${ARC_LEVEL_LABELS[nextLevel].toLowerCase()} ívekre.` : ''}</p>
              ) : (
                <div className="space-y-1.5">
                  {selected.children.map(c => (
                    <div key={c.id} onClick={() => setSelectedId(c.id)} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-violet-50 cursor-pointer">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[c.level]}`} />
                      <span className="flex-1 text-sm text-gray-800 truncate">{c.title}{arcPeriodLabel(c) && <span className="ml-2 text-[10px] text-gray-400">{arcPeriodLabel(c)}</span>}</span>
                      <div className="w-24 shrink-0"><FillBar percent={c.fill.percent} small /></div>
                      {c.fill.percent !== null && <span className="text-xs text-gray-500 w-9 text-right shrink-0">{Math.round(c.fill.percent)}%</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Témák */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Lightbulb size={13} className="text-gray-400" /> Témák / körök ({detail?.themes.length ?? 0})</h3>
              <button onClick={() => setThemeModal({ theme: null, arcId: selected.id })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Plus size={12} /> Téma</button>
            </div>
            {!detail || detail.themes.length === 0 ? (
              <p className="text-xs text-gray-400">Vegyél fel témát: a mondanivaló és a vázlat rögzítése — ebből generálódik a tartalom.</p>
            ) : (
              <div className="space-y-1.5">
                {detail.themes.map(t => (
                  <div key={t.id} onClick={() => setThemeModal({ theme: t as ArcTheme, arcId: selected.id })} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-amber-50 cursor-pointer">
                    <Lightbulb size={13} className="text-amber-400 shrink-0" />
                    <span className="flex-1 text-sm text-gray-800 truncate">{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0 rounded-full ${THEME_STATUS_LABELS[t.status]?.color}`}>{THEME_STATUS_LABELS[t.status]?.label}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5"><FileText size={9} />{t._count?.pieces ?? 0}</span>
                    <button onClick={e => { e.stopPropagation(); setPieceModal({ arcId: selected.id, themeId: t.id }) }} className="text-violet-400 hover:text-violet-600 shrink-0" title="Tartalom a témához"><Plus size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tartalmak */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FileText size={13} className="text-gray-400" /> Tartalmak ({detail?.pieces.length ?? 0})</h3>
              <button onClick={() => setPieceModal({ arcId: selected.id })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100"><Plus size={12} /> Tartalom</button>
            </div>
            {!detail || detail.pieces.length === 0 ? (
              <p className="text-xs text-gray-400">Ehhez az ívhez még nincs közvetlen tartalom. Tűzz ide ad-hoc posztot, vagy hozz létre témát.</p>
            ) : (
              <div className="space-y-1">
                {detail.pieces.map(p => {
                  const ci = channelInfo(p.channel)
                  return (
                    <Link key={p.id} href={`/marketing/piece/${p.id}`} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-violet-50">
                      <span className="text-sm shrink-0">{ci?.icon}</span>
                      <span className="flex-1 text-sm text-gray-800 truncate">{p.title}</span>
                      {p.scheduledFor && <span className="text-[10px] text-gray-400 shrink-0">{new Date(p.scheduledFor).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })}</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {arcModal && (
        <Modal title={arcModal.arc ? 'Ív szerkesztése' : 'Új marketing-ív'} onClose={() => setArcModal(null)} size="lg">
          <ArcForm arc={arcModal.arc as never} defaultLevel={arcModal.defaultLevel} defaultParentId={arcModal.defaultParentId} onSave={saved} onCancel={() => setArcModal(null)} />
        </Modal>
      )}
      {themeModal && (
        <Modal title={themeModal.theme ? 'Téma szerkesztése' : 'Új téma'} onClose={() => setThemeModal(null)} size="lg">
          <ThemeForm theme={themeModal.theme as never} defaultArcId={themeModal.arcId} onSave={saved} onCancel={() => setThemeModal(null)} />
        </Modal>
      )}
      {pieceModal && (
        <Modal title="Új tartalom" onClose={() => setPieceModal(null)} size="lg">
          <PieceForm defaultArcId={pieceModal.arcId} defaultThemeId={pieceModal.themeId} onSave={(newId) => { setPieceModal(null); router.push(`/marketing/piece/${newId}`) }} onCancel={() => setPieceModal(null)} />
        </Modal>
      )}
    </div>
  )
}
