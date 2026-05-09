import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Memini Sales',
  description: 'Értékesítési bemutató alkalmazás',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body className={`${inter.className} bg-[#0a0a0a] text-white`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
