'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Mutasd a nyitott számlákat',
  'Vannak lejárt fizetések?',
  'Mi a havi bevétel?',
  'Sorold fel a cégeket',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hiba történt. Kérlek próbáld újra.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Fejléc */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Memini AI</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">CRM asszisztens</p>
        </div>
      </div>

      {/* Üzenetek */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Bot size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Szia Laci! Miben segíthetek?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kérdezz a CRM adataidról magyarul</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-gray-700 dark:bg-gray-600'
                : 'bg-blue-600'
            }`}>
              {msg.role === 'user'
                ? <User size={16} className="text-white" />
                : <Bot size={16} className="text-white" />
              }
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-gray-800 dark:bg-gray-700 text-white rounded-tr-sm'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 size={16} className="text-blue-500 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Írj üzenetet..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">Enter = küldés · Shift+Enter = új sor</p>
      </div>
    </div>
  )
}
