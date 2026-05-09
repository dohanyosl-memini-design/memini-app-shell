import Link from 'next/link'
import Image from 'next/image'

const TILES = [
  {
    href: '/new-partner',
    label: 'Új partner',
    icon: '＋',
    desc: 'Partner felvétele a CRM-be',
  },
  {
    href: '/products',
    label: 'Megrendelés',
    icon: '🛒',
    desc: 'Termékek és ajánlat',
  },
  {
    href: '/cities',
    label: 'Városok',
    icon: '📍',
    desc: 'Termékek helyszín szerint',
  },
  {
    href: '/partners',
    label: 'Partnerek',
    icon: '👥',
    desc: 'Meglévő partnerek',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-10 pb-6">
        <Image
          src="/memini-logo.svg"
          alt="Memini"
          width={110}
          height={32}
          priority
        />
      </header>

      {/* Grid */}
      <main className="flex-1 px-4 pb-8">
        <div className="grid grid-cols-2 gap-3 mt-2">
          {TILES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group relative bg-[#161616] border border-white/8 rounded-2xl p-5 flex flex-col justify-between min-h-[160px] active:scale-95 transition-transform"
            >
              <span className="text-3xl">{tile.icon}</span>
              <div>
                <p className="text-white font-semibold text-lg leading-tight">{tile.label}</p>
                <p className="text-white/40 text-xs mt-0.5">{tile.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
