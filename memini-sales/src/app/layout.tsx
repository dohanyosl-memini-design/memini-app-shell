import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Memini Sales',
  description: 'Értékesítési bemutató alkalmazás',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
