import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_CARRIERS = [
  // ── Kő ───────────────────────────────────────────────────────────────────
  { code: 'ko_grafitoptik_normal', name: 'Kő Grafitoptik GO – normál',        nameDE: 'Stein Graphitoptik GO – normal',                group: 'Kő',          sortOrder: 1  },
  { code: 'ko_grafitoptik_nagy',   name: 'Kő Grafitoptik GO – nagy',           nameDE: 'Stein Graphitoptik GO – groß',                  group: 'Kő',          sortOrder: 2  },
  { code: 'ko_aquarel_normal',     name: 'Kő Aquarelle – normál',              nameDE: 'Stein Aquarelle – normal',                      group: 'Kő',          sortOrder: 3  },
  { code: 'ko_aquarel_nagy',       name: 'Kő Aquarelle – nagy',                nameDE: 'Stein Aquarelle – groß',                        group: 'Kő',          sortOrder: 4  },
  // ── Bélyeg ───────────────────────────────────────────────────────────────
  { code: 'belyeg_1_normal',       name: 'Bélyeg egyrétegű – normál',          nameDE: 'Stempel einlagig – normal',                     group: 'Bélyeg',      sortOrder: 5  },
  { code: 'belyeg_1_kicsi',        name: 'Bélyeg egyrétegű – kicsi',           nameDE: 'Stempel einlagig – klein',                      group: 'Bélyeg',      sortOrder: 6  },
  { code: 'belyeg_2',              name: 'Bélyeg kétrétegű',                   nameDE: 'Stempel zweilagig',                             group: 'Bélyeg',      sortOrder: 7  },
  { code: '0',                     name: 'Bélyeg kétrétegű 75×55',             nameDE: 'Stempel zweilagig 75×55',                       group: 'Bélyeg',      sortOrder: 8  },
  // ── Fa ───────────────────────────────────────────────────────────────────
  { code: 'faszelet_go',           name: 'Faszelet Grafitoptik GO',            nameDE: 'Holzscheibe Graphitoptik GO',                   group: 'Fa',          sortOrder: 9  },
  { code: 'fa_nagybetus',          name: 'Fa Nagybetűs',                       nameDE: 'Holz Großbuchstaben',                           group: 'Fa',          sortOrder: 10 },
  { code: '0',                     name: 'Fa Nagybetűs (AQ)',                  nameDE: 'Holz Großbuchstaben (AQ)',                      group: 'Fa',          sortOrder: 11 },
  { code: '0',                     name: 'Antikoptik Fa Kép GO – Natur 13×9',  nameDE: 'Antiquoptik Holzbild GO – Natur 13×9 cm',       group: 'Fa',          sortOrder: 12 },
  { code: '0',                     name: 'Antikoptik Fa Kép AQ – Színes 13×9', nameDE: 'Antiquoptik Holzbild AQ – Farbig 13×9 cm',      group: 'Fa',          sortOrder: 13 },
  // ── Ablak ─────────────────────────────────────────────────────────────────
  { code: 'templomablak_kicsi',    name: 'Templomablak – kicsi',               nameDE: 'Kirchenfenster – klein',                        group: 'Ablak',       sortOrder: 14 },
  { code: 'templomablak_nagy',     name: 'Templomablak – nagy',                nameDE: 'Kirchenfenster – groß',                         group: 'Ablak',       sortOrder: 15 },
  { code: '0',                     name: 'Ablak Hűtőmágnes – kicsi',           nameDE: 'Fenster Kühlschrankmagnet – klein',             group: 'Ablak',       sortOrder: 16 },
  { code: '0',                     name: 'Ablakhűtőmágnes 12,5×5,5',           nameDE: 'Fenster Kühlschrankmagnet 12,5×5,5',            group: 'Ablak',       sortOrder: 17 },
  { code: '0',                     name: 'Ablakhűtőmágnes 15×5,5',             nameDE: 'Fenster Kühlschrankmagnet 15×5,5',              group: 'Ablak',       sortOrder: 18 },
  { code: '0',                     name: 'Kerek Ablakhűtőmágnes',              nameDE: 'Rund Fenster Kühlschrankmagnet',                group: 'Ablak',       sortOrder: 19 },
  // ── Lézervágott ───────────────────────────────────────────────────────────
  { code: '0',                     name: 'Natur Lézervágott Hűtőmágnes',       nameDE: 'Natur Laserschnitt Kühlschrankmagnet',          group: 'Lézervágott', sortOrder: 20 },
  { code: '0',                     name: 'Lézervágott kulcstartó – AQ Színes', nameDE: 'Laserschnitt Schlüsselanhänger – AQ Farbig',    group: 'Lézervágott', sortOrder: 21 },
  // ── Egyéb ─────────────────────────────────────────────────────────────────
  { code: '0',                     name: 'Kork Hűtőmágnes',                    nameDE: 'Kork Kühlschrankmagnet',                        group: 'Egyéb',       sortOrder: 22 },
  { code: '0',                     name: 'Bambusztoll',                        nameDE: 'Bambus-Kugelschreiber',                         group: 'Egyéb',       sortOrder: 23 },
  { code: '0',                     name: 'Kerek Karácsonydísz',                nameDE: 'Weihnachtsschmuck rund',                        group: 'Egyéb',       sortOrder: 24 },
  { code: '0',                     name: '3D Nyomtatott termék',               nameDE: '3D Gedrucktes Produkt',                         group: 'Egyéb',       sortOrder: 25 },
]

export async function GET() {
  const existing = await prisma.carrier.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  const existingNames = new Set(existing.map(c => c.name))
  const missing = DEFAULT_CARRIERS.filter(c => !existingNames.has(c.name))

  if (missing.length > 0) {
    await prisma.carrier.createMany({ data: missing })
    return NextResponse.json(
      await prisma.carrier.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    )
  }

  return NextResponse.json(existing)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const last = await prisma.carrier.findFirst({ orderBy: { sortOrder: 'desc' } })
  const carrier = await prisma.carrier.create({
    data: {
      code: body.code,
      name: body.name,
      nameDE: body.nameDE || null,
      group: body.group || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      supplierId: body.supplierId || null,
    },
  })
  return NextResponse.json(carrier, { status: 201 })
}
