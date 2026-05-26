'use client'

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { Lock, XCircle } from 'lucide-react'

interface Props {
  title: string
  description: string
  onSubmit: (pin: string) => void
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

export default function PinModal({ title, description, onSubmit, onCancel, loading, error }: Props) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const pin = digits.join('')
  const complete = pin.length === 6

  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]
        next[i] = ''
        setDigits(next)
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'Enter' && complete && !loading) {
      onSubmit(pin)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    const focusIdx = Math.min(pasted.length, 5)
    refs.current[focusIdx]?.focus()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-blue-50 rounded-2xl mb-4">
            <Lock size={28} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-11 h-14 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-colors
                ${error ? 'border-red-400 bg-red-50 text-red-700' : d ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-800'}
                focus:border-blue-500 focus:bg-white`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 justify-center mb-5 text-red-600">
            <XCircle size={15} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Mégse
          </button>
          <button
            onClick={() => onSubmit(pin)}
            disabled={!complete || loading}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Ellenőrzés...' : 'Megerősítés'}
          </button>
        </div>
      </div>
    </div>
  )
}
