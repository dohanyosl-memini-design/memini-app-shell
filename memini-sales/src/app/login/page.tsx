'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { Background } from '@/components/Background'
import { useTheme } from '@/contexts/ThemeContext'

export default function LoginPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Hibás email vagy jelszó.')
    } else {
      router.push('/home')
    }
  }

  return (
    <>
      <Background />
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Glass card */}
        <div
          className="w-full max-w-sm rounded-3xl p-8 shadow-2xl"
          style={{
            background: theme.cardBg,
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image src="/memini-logo.svg" alt="Memini" width={120} height={35} priority />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="flex-1 bg-transparent text-base outline-none placeholder-opacity-50"
                style={{ color: theme.textPrimary }}
              />
            </div>

            {/* Password */}
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Jelszó"
                required
                className="flex-1 bg-transparent text-base outline-none"
                style={{ color: theme.textPrimary }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ color: theme.textSecondary }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-semibold text-base transition disabled:opacity-50 mt-2"
              style={{ background: theme.buttonBg, color: theme.buttonText }}
            >
              {loading ? 'Bejelentkezés...' : 'Belépés'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
