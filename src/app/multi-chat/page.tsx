'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, RefreshCw, Users, Bot } from 'lucide-react'

type Mode = 'parallel' | 'roundtable'

interface Colors {
  headerBg: string
  headerFg: string
  msgBg: string
  msgBorder: string
  msgText: string
  badge: string
}

interface Agent {
  id: string
  name: string
  emoji: string
  active: boolean
  systemPrompt: string
  colors: Colors
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface RtMsg {
  id: string
  agentId: string
  agentName: string
  emoji: string
  colors: Colors
  content: string
  round: number
}

const C: Record<string, Colors> = {
  blue: {
    headerBg: 'bg-blue-500', headerFg: 'text-white',
    msgBg: 'bg-blue-50 dark:bg-blue-950/40', msgBorder: 'border-blue-200 dark:border-blue-800',
    msgText: 'text-blue-900 dark:text-blue-100',
    badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700',
  },
  red: {
    headerBg: 'bg-red-500', headerFg: 'text-white',
    msgBg: 'bg-red-50 dark:bg-red-950/40', msgBorder: 'border-red-200 dark:border-red-800',
    msgText: 'text-red-900 dark:text-red-100',
    badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-200 dark:border-red-700',
  },
  purple: {
    headerBg: 'bg-purple-500', headerFg: 'text-white',
    msgBg: 'bg-purple-50 dark:bg-purple-950/40', msgBorder: 'border-purple-200 dark:border-purple-800',
    msgText: 'text-purple-900 dark:text-purple-100',
    badge: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700',
  },
  green: {
    headerBg: 'bg-green-500', headerFg: 'text-white',
    msgBg: 'bg-green-50 dark:bg-green-950/40', msgBorder: 'border-green-200 dark:border-green-800',
    msgText: 'text-green-900 dark:text-green-100',
    badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/60 dark:text-green-200 dark:border-green-700',
  },
  amber: {
    headerBg: 'bg-amber-500', headerFg: 'text-white',
    msgBg: 'bg-amber-50 dark:bg-amber-950/40', msgBorder: 'border-amber-200 dark:border-amber-800',
    msgText: 'text-amber-900 dark:text-amber-100',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700',
  },
}

const USER_COLORS: Colors = {
  headerBg: 'bg-gray-700', headerFg: 'text-white',
  msgBg: 'bg-gray-800', msgBorder: 'border-gray-600',
  msgText: 'text-white', badge: '',
}

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'strategist', name: 'Stratéga', emoji: '🎯', active: true, colors: C.blue,
    systemPrompt: `Te egy tapasztalt üzleti stratéga vagy a Memini Design (B2B souvenir termékek Németországban) kontextusában. Mindig magyarul válaszolj. Fókuszálj a hosszú távú üzleti hatásra, növekedési lehetőségekre és versenyelőnyre. Legyél konkrét, tömör és magabiztos.`,
  },
  {
    id: 'critic', name: 'Kritikus', emoji: '🔥', active: true, colors: C.red,
    systemPrompt: `Te az "ördög ügyvédje" vagy üzleti vitákban. Mindig magyarul válaszolj. Kérdőjelezd meg a feltételezéseket, mutass rá a kockázatokra és gyengeségekre. Légy konstruktívan kritikus — a cél a gondolkodás élesítése, nem a rombolás.`,
  },
  {
    id: 'creative', name: 'Kreatív', emoji: '✨', active: true, colors: C.purple,
    systemPrompt: `Te egy kreatív gondolkodó vagy. Mindig magyarul válaszolj. Hozz fel szokatlan ötleteket, innovatív megközelítéseket, analógiákat. Légy merész és eredeti — a mások által nem látott lehetőségeket keresd.`,
  },
  {
    id: 'analyst', name: 'Elemző', emoji: '📊', active: false, colors: C.green,
    systemPrompt: `Te egy adatalapú elemző vagy. Mindig magyarul válaszolj. Kérj konkrét mérőszámokat, számokat. Legyen strukturált és logikus a gondolkodásod. Mindig tedd fel a kérdést: "Hogyan mérjük ezt meg?"`,
  },
  {
    id: 'customer', name: 'Vevő', emoji: '🛍️', active: false, colors: C.amber,
    systemPrompt: `Te egy tipikus B2B vevőt képviselsz: kastély- vagy múzeumi shopvezető Németországban. Mindig magyarul válaszolj (de a vevő fejével gondolkodj). Mondd el, mi fontos a vevőnek, mi a félelme, mi motiválja, mi köti meg döntési helyzetben.`,
  },
]

// ── AgentColumn ─────────────────────────────────────────────────────────────

function AgentColumn({ agent, messages, loading }: {
  agent: Agent
  messages: ChatMsg[]
  loading: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <div className={`shrink-0 flex items-center gap-2 px-3 py-2.5 ${agent.colors.headerBg}`}>
        <span className="text-base">{agent.emoji}</span>
        <span className={`font-semibold text-sm ${agent.colors.headerFg}`}>{agent.name}</span>
        {loading && <Loader2 size={13} className={`ml-auto animate-spin opacity-80 ${agent.colors.headerFg}`} />}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50 dark:bg-gray-950">
        {messages.length === 0 && !loading && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-10">Küldj egy üzenetet...</p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            {msg.role === 'user' ? (
              <div className="max-w-[90%] bg-gray-800 dark:bg-gray-700 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              <div className={`max-w-[95%] ${agent.colors.msgBg} ${agent.colors.msgText} border ${agent.colors.msgBorder} rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap`}>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className={`inline-flex items-center gap-2 ${agent.colors.msgBg} border ${agent.colors.msgBorder} rounded-2xl rounded-tl-sm px-3 py-2`}>
            <Loader2 size={13} className={`animate-spin ${agent.colors.msgText}`} />
            <span className={`text-xs ${agent.colors.msgText}`}>Gondolkodik...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MultiChatPage() {
  const [mode, setMode] = useState<Mode>('parallel')
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS)
  const [showAgentPanel, setShowAgentPanel] = useState(false)

  // Parallel mode
  const [histories, setHistories] = useState<Record<string, ChatMsg[]>>({})
  const [parallelInput, setParallelInput] = useState('')
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set())
  const [mobileTab, setMobileTab] = useState<string>('strategist')

  // Roundtable mode
  const [rtMessages, setRtMessages] = useState<RtMsg[]>([])
  const [rtTopic, setRtTopic] = useState('')
  const [rtInput, setRtInput] = useState('')
  const [rtStarted, setRtStarted] = useState(false)
  const [rtCurrentAgent, setRtCurrentAgent] = useState<string | null>(null)
  const [rtRound, setRtRound] = useState(0)
  const [rtInjection, setRtInjection] = useState('')

  const parallelInputRef = useRef<HTMLTextAreaElement>(null)
  const rtInputRef = useRef<HTMLTextAreaElement>(null)
  const rtBottomRef = useRef<HTMLDivElement>(null)

  const activeAgents = agents.filter(a => a.active)

  useEffect(() => {
    rtBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rtMessages, rtCurrentAgent])

  useEffect(() => {
    if (!activeAgents.find(a => a.id === mobileTab) && activeAgents.length > 0) {
      setMobileTab(activeAgents[0].id)
    }
  }, [agents]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAgent(id: string) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  function clearAll() {
    setHistories({})
    setRtMessages([])
    setRtTopic('')
    setRtStarted(false)
    setRtRound(0)
    setRtCurrentAgent(null)
    setRtInjection('')
  }

  // ── Parallel mode ──────────────────────────────────────────────────────────

  async function sendParallel() {
    const msg = parallelInput.trim()
    if (!msg || loadingSet.size > 0 || activeAgents.length === 0) return
    setParallelInput('')

    const snapshot: Record<string, ChatMsg[]> = {}
    for (const a of activeAgents) {
      snapshot[a.id] = [...(histories[a.id] || []), { role: 'user', content: msg }]
    }
    setHistories(prev => ({ ...prev, ...snapshot }))
    setLoadingSet(new Set(activeAgents.map(a => a.id)))

    await Promise.all(
      activeAgents.map(async (agent) => {
        try {
          const res = await fetch('/api/multi-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt: agent.systemPrompt, messages: snapshot[agent.id] }),
          })
          const data = await res.json()
          const content: string = data.content ?? data.error ?? 'Hiba'
          setHistories(prev => ({
            ...prev,
            [agent.id]: [...(prev[agent.id] || []), { role: 'assistant', content }],
          }))
        } catch {
          setHistories(prev => ({
            ...prev,
            [agent.id]: [...(prev[agent.id] || []), { role: 'assistant', content: 'Hálózati hiba' }],
          }))
        } finally {
          setLoadingSet(prev => { const n = new Set(prev); n.delete(agent.id); return n })
        }
      })
    )
  }

  function handleParallelKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendParallel() }
  }

  // ── Roundtable mode ────────────────────────────────────────────────────────

  async function startRoundtable() {
    const topic = rtInput.trim()
    if (!topic || activeAgents.length === 0 || rtCurrentAgent) return
    setRtTopic(topic)
    setRtInput('')
    setRtStarted(true)
    setRtRound(1)
    await runRound(topic, [], undefined, 1)
  }

  async function nextRound() {
    if (rtCurrentAgent || !rtStarted) return
    const injection = rtInjection.trim() || undefined
    setRtInjection('')
    const newRound = rtRound + 1
    setRtRound(newRound)
    await runRound(rtTopic, rtMessages, injection, newRound)
  }

  async function runRound(
    topic: string,
    currentMsgs: RtMsg[],
    injection: string | undefined,
    round: number,
  ) {
    let all = [...currentMsgs]

    if (injection) {
      const userMsg: RtMsg = {
        id: `user-${Date.now()}`, agentId: 'user', agentName: 'Moderátor',
        emoji: '👤', colors: USER_COLORS, content: injection, round,
      }
      all = [...all, userMsg]
      setRtMessages(all)
    }

    const historyLines = all.map(m => `[${m.agentName}]: ${m.content}`)

    for (const agent of activeAgents) {
      setRtCurrentAgent(agent.id)

      const contextParts: string[] = []
      if (topic) contextParts.push(`A vita témája: "${topic}"\n`)
      if (historyLines.length > 0) {
        contextParts.push('Eddigi hozzászólások:')
        contextParts.push(...historyLines)
        contextParts.push('')
      }
      contextParts.push(`Most te következel (${agent.name}). Reagálj a kontextusra a saját szereped alapján. Légy tömör, max 3-4 mondat.`)

      try {
        const res = await fetch('/api/multi-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: agent.systemPrompt,
            messages: [{ role: 'user', content: contextParts.join('\n') }],
            maxTokens: 384,
          }),
        })
        const data = await res.json()
        const content: string = data.content ?? data.error ?? 'Hiba'
        const newMsg: RtMsg = {
          id: `${agent.id}-${Date.now()}`, agentId: agent.id,
          agentName: agent.name, emoji: agent.emoji, colors: agent.colors,
          content, round,
        }
        all = [...all, newMsg]
        historyLines.push(`[${agent.name}]: ${content}`)
        setRtMessages([...all])
      } catch {
        const errMsg: RtMsg = {
          id: `${agent.id}-err-${Date.now()}`, agentId: agent.id,
          agentName: agent.name, emoji: agent.emoji, colors: agent.colors,
          content: 'Hálózati hiba', round,
        }
        all = [...all, errMsg]
        setRtMessages([...all])
      }
    }

    setRtCurrentAgent(null)
  }

  function handleRtKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!rtStarted) startRoundtable()
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const currentAgentObj = agents.find(a => a.id === rtCurrentAgent)

  // Group roundtable messages by round
  const rtByRound = new Map<number, RtMsg[]>()
  for (const msg of rtMessages) {
    if (!rtByRound.has(msg.round)) rtByRound.set(msg.round, [])
    rtByRound.get(msg.round)!.push(msg)
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <Bot size={15} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-900 dark:text-white hidden sm:inline whitespace-nowrap">Multi AI Chat</span>

        {/* Mode tabs */}
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 text-xs ml-1">
          {(['parallel', 'roundtable'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                mode === m
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {m === 'parallel' ? 'Párhuzamos' : 'Kerekasztal'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Agents toggle */}
        <button
          onClick={() => setShowAgentPanel(p => !p)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            showAgentPanel
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <Users size={13} />
          <span className="hidden sm:inline">Ügynökök</span>
          <span className="font-semibold">({activeAgents.length})</span>
        </button>

        <button
          onClick={clearAll}
          title="Törlés"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Agent panel ── */}
      {showAgentPanel && (
        <div className="shrink-0 px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Ügynökök</p>
          <div className="flex flex-wrap gap-1.5">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium transition-all ${
                  agent.active
                    ? agent.colors.badge
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span>{agent.emoji}</span>
                <span>{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {mode === 'parallel' ? (
          activeAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <span className="text-4xl">🤖</span>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Nincs aktív ügynök</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kattints az "Ügynökök" gombra a fejlécben.</p>
            </div>
          ) : (
            <>
              {/* Mobile: tab selector */}
              <div className="flex md:hidden shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                {activeAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setMobileTab(agent.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      mobileTab === agent.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{agent.emoji}</span>
                    <span>{agent.name}</span>
                    {loadingSet.has(agent.id) && (
                      <Loader2 size={11} className="animate-spin ml-0.5 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Mobile: single column */}
              <div className="flex md:hidden flex-col" style={{ height: 'calc(100% - 41px)' }}>
                {activeAgents.filter(a => a.id === mobileTab).map(agent => (
                  <AgentColumn
                    key={agent.id}
                    agent={agent}
                    messages={histories[agent.id] || []}
                    loading={loadingSet.has(agent.id)}
                  />
                ))}
                {!activeAgents.find(a => a.id === mobileTab) && activeAgents[0] && (
                  <AgentColumn
                    agent={activeAgents[0]}
                    messages={histories[activeAgents[0].id] || []}
                    loading={loadingSet.has(activeAgents[0].id)}
                  />
                )}
              </div>

              {/* Desktop: columns */}
              <div className="hidden md:flex h-full divide-x divide-gray-200 dark:divide-gray-800">
                {activeAgents.map(agent => (
                  <AgentColumn
                    key={agent.id}
                    agent={agent}
                    messages={histories[agent.id] || []}
                    loading={loadingSet.has(agent.id)}
                  />
                ))}
              </div>
            </>
          )
        ) : (
          /* ── Roundtable content ── */
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 py-4 space-y-1">

                {!rtStarted && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <span className="text-4xl">🗣️</span>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Kerekasztal vita</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Add meg a témát és az ügynökök megvitatják egymás között.
                    </p>
                  </div>
                )}

                {rtStarted && rtTopic && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-center mb-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Téma</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">„{rtTopic}"</p>
                  </div>
                )}

                {Array.from(rtByRound.entries()).map(([roundNum, msgs]) => (
                  <div key={roundNum}>
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider px-2">
                        {roundNum}. kör
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-3">
                      {msgs.map(msg => (
                        <div key={msg.id} className={msg.agentId === 'user' ? 'flex justify-end' : 'flex items-start gap-2'}>
                          {msg.agentId === 'user' ? (
                            <div className="flex items-start gap-2 flex-row-reverse max-w-[85%]">
                              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-xs">
                                {msg.emoji}
                              </div>
                              <div className="bg-gray-800 dark:bg-gray-700 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.content}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={`w-7 h-7 rounded-full ${msg.colors.headerBg} flex items-center justify-center shrink-0 text-xs`}>
                                {msg.emoji}
                              </div>
                              <div className="max-w-[85%]">
                                <p className={`text-[11px] font-semibold mb-1 ${msg.colors.msgText}`}>{msg.agentName}</p>
                                <div className={`${msg.colors.msgBg} ${msg.colors.msgText} border ${msg.colors.msgBorder} rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap`}>
                                  {msg.content}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {rtCurrentAgent && currentAgentObj && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className={`w-7 h-7 rounded-full ${currentAgentObj.colors.headerBg} flex items-center justify-center shrink-0 text-xs`}>
                      {currentAgentObj.emoji}
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 py-2">
                      <Loader2 size={13} className="animate-spin text-blue-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{currentAgentObj.name} gondolkodik...</span>
                    </div>
                  </div>
                )}

                <div ref={rtBottomRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      {mode === 'parallel' ? (
        <div className="shrink-0 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="flex gap-2 items-end">
            <textarea
              ref={parallelInputRef}
              value={parallelInput}
              onChange={e => setParallelInput(e.target.value)}
              onKeyDown={handleParallelKey}
              placeholder={activeAgents.length === 0 ? 'Aktiválj legalább egy ügynököt...' : `Küldés az összes ügynöknek (${activeAgents.length} aktív)...`}
              disabled={activeAgents.length === 0}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 max-h-32 overflow-y-auto disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={sendParallel}
              disabled={!parallelInput.trim() || loadingSet.size > 0 || activeAgents.length === 0}
              className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loadingSet.size > 0 ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
            Enter = küldés · Shift+Enter = új sor
          </p>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          {!rtStarted ? (
            /* Roundtable not started: topic input */
            <>
              <div className="flex gap-2 items-end">
                <textarea
                  ref={rtInputRef}
                  value={rtInput}
                  onChange={e => setRtInput(e.target.value)}
                  onKeyDown={handleRtKey}
                  placeholder={'Írd be a vita témáját... pl. "Érdemes-e új piacra lépni 2025-ben?"'}
                  rows={1}
                  disabled={activeAgents.length === 0}
                  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <button
                  onClick={startRoundtable}
                  disabled={!rtInput.trim() || activeAgents.length === 0}
                  className="px-4 h-11 rounded-xl bg-purple-600 flex items-center gap-2 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap"
                >
                  🗣️ <span className="hidden sm:inline">Vita indítása</span>
                </button>
              </div>
              {activeAgents.length === 0 && (
                <p className="text-[10px] text-red-400 mt-1.5">Aktiválj legalább egy ügynököt az Ügynökök gombbal.</p>
              )}
            </>
          ) : (
            /* Roundtable started: injection + next round */
            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <textarea
                  value={rtInjection}
                  onChange={e => setRtInjection(e.target.value)}
                  placeholder="Hozzáfűznél valamit a következő körbe? (opcionális)"
                  rows={1}
                  disabled={!!rtCurrentAgent}
                  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 max-h-24 overflow-y-auto disabled:opacity-50"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <button
                  onClick={nextRound}
                  disabled={!!rtCurrentAgent}
                  className="px-4 h-11 rounded-xl bg-purple-600 flex items-center gap-2 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap"
                >
                  {rtCurrentAgent
                    ? <Loader2 size={15} className="animate-spin" />
                    : <>▶ <span className="hidden sm:inline">{rtRound + 1}. kör</span></>
                  }
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                {rtCurrentAgent
                  ? `${currentAgentObj?.name ?? 'Ügynök'} válaszol...`
                  : `${rtRound}. kör kész · Indítsd el a következő kört vagy fűzz hozzá egy gondolatot`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
