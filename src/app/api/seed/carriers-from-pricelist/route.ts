import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// Pricelist entries where the NAME is already German — provide Hungarian equivalent
const GERMAN_ENTRIES: Record<string, string> = {
  'Fenster Kühlschrankmagnet 12,5×5,5': 'Ablakhűtőmágnes 12,5×5,5',
  'Fenster Kühlschrankmagnet 15×5,5':   'Ablakhűtőmágnes 15×5,5',
  'Rund Fenster Kühlschrankmagnet':      'Kerek Ablakhűtőmágnes',
  'Weihnachtsschmuck rund':              'Kerek Karácsonydísz',
}

// Hungarian pricelist names → German translation
const HU_TO_DE: Record<string, string> = {
  'Kő Grafitoptik GO – normál':               'Stein Graphitoptik GO – normal',
  'Kő Grafitoptik GO – nagy':                 'Stein Graphitoptik GO – groß',
  'Kő Aquarelle – normál':                    'Stein Aquarelle – normal',
  'Kő Aquarelle – nagy':                      'Stein Aquarelle – groß',
  'Bélyeg egyrétegű – normál':               'Stempel einlagig – normal',
  'Bélyeg egyrétegű – kicsi':                'Stempel einlagig – klein',
  'Bélyeg kétrétegű 75×55':                  'Stempel zweilagig 75×55',
  'Faszelet Grafitoptik GO':                  'Holzscheibe Graphitoptik GO',
  'Fa Nagybetűs (AQ)':                        'Holz Großbuchstaben (AQ)',
  'Antikoptik Fa Kép GO – Natur 13×9 cm':    'Antiquoptik Holzbild GO – Natur 13×9 cm',
  'Antikoptik Fa Kép AQ – Színes 13×9 cm':  'Antiquoptik Holzbild AQ – Farbig 13×9 cm',
  'Natur Lézervágott Hűtőmágnes':            'Natur Laserschnitt Kühlschrankmagnet',
  'Ablak Hűtőmágnes – kicsi':               'Fenster Kühlschrankmagnet – klein',
  'Lézervágott kulcstartó – AQ Színes':      'Laserschnitt Schlüsselanhänger – AQ Farbig',
  'Kork Hűtőmágnes':                         'Kork Kühlschrankmagnet',
  'Bambusztoll':                              'Bambus-Kugelschreiber',
  '3D Nyomtatott termék':                     '3D Gedrucktes Produkt',
}

function toGroup(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('kő') || n.includes('stein') || n.includes('aquarelle') || n.includes('antikoptik')) return 'Kő'
  if (n.includes('bélyeg') || n.includes('stempel')) return 'Bélyeg'
  if (n.includes('faszelet') || n.includes('fa ') || n.includes('holz') || n.includes('nagybetűs')) return 'Fa'
  if (n.includes('ablak') || n.includes('fenster')) return 'Ablak'
  if (n.includes('lézervágott') || n.includes('laserschnitt')) return 'Lézervágott'
  return 'Egyéb'
}

export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied

  const entries = await prisma.priceListEntry.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  if (entries.length === 0) {
    return NextResponse.json({ ok: false, message: 'Nincs ártáblázat bejegyzés.' })
  }

  const existingNames = new Set(
    (await prisma.carrier.findMany({ select: { name: true } })).map(c => c.name)
  )

  const toCreate = entries
    .map(e => {
      const isGerman = e.name in GERMAN_ENTRIES
      const huName  = isGerman ? GERMAN_ENTRIES[e.name] : e.name
      const deName  = isGerman ? e.name : (HU_TO_DE[e.name] ?? null)
      return {
        code:      '0',
        name:      huName,
        nameDE:    deName,
        group:     toGroup(huName),
        sortOrder: e.sortOrder ?? 99,
      }
    })
    .filter(c => !existingNames.has(c.name))

  if (toCreate.length === 0) {
    return NextResponse.json({ ok: true, added: 0, message: 'Minden hordozó már létezik — nincs új bejegyzés.' })
  }

  await prisma.carrier.createMany({ data: toCreate })

  return NextResponse.json({
    ok: true,
    added: toCreate.length,
    carriers: toCreate.map(c => ({ name: c.name, nameDE: c.nameDE, group: c.group })),
  })
}
