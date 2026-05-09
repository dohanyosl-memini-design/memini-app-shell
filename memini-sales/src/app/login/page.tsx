'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-12">
          <Image src="/memini-logo.svg" alt="Memini" width={130} height={38} priority />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#161616] border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30 text-base"
              placeholder="email@memini.de"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Jelszó</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#161616] border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30 text-base"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white hover:bg-white/90 text-black font-semibold rounded-xl transition disabled:opacity-40 text-base mt-2"
          >
            {loading ? 'Bejelentkezés...' : 'Belépés'}
          </button>
        </form>
      </div>
    </div>
  )
}
