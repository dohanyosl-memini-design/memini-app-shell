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
    <div
      className="min-h-screen bg-[#0a0a0a] flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-8 pb-6 md:px-10 md:pt-12 md:pb-8 lg:px-16 lg:pt-14">
        <Image
          src="/memini-logo.svg"
          alt="Memini"
          width={110}
          height={32}
          className="md:w-[140px] md:h-[40px] lg:w-[160px] lg:h-[46px]"
          priority
        />
      </header>

      {/* Tile grid */}
      <main className="flex-1 flex items-start justify-center px-4 pb-8 md:px-10 md:pb-12 lg:px-16 lg:items-center">
        <div className="w-full max-w-3xl">
          {/* Portrait (mobile + iPad): 2 cols | Landscape (iPad): 4 cols */}
          <div className="grid grid-cols-2 landscape:md:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
            {TILES.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="
                  group relative bg-[#161616] border border-white/[0.08]
                  rounded-2xl md:rounded-3xl
                  p-5 md:p-7 lg:p-8
                  flex flex-col justify-between
                  min-h-[150px] md:min-h-[200px] lg:min-h-[240px]
                  landscape:min-h-[140px] landscape:md:min-h-[180px]
                  active:scale-[0.97] transition-transform duration-150
                "
              >
                <span className="text-3xl md:text-4xl lg:text-5xl">{tile.icon}</span>
                <div>
                  <p className="text-white font-semibold text-base md:text-xl lg:text-2xl leading-tight">
                    {tile.label}
                  </p>
                  <p className="text-white/40 text-xs md:text-sm mt-0.5 md:mt-1">
                    {tile.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
