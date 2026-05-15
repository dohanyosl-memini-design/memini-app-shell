import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_CARRIERS = [
  { code: 'ko_grafitoptik_normal', name: 'Kő Grafitoptik GO – normál', nameDE: 'Stein Graphitoptik GO – normal', group: 'Kő',           sortOrder: 1 },
  { code: 'ko_grafitoptik_nagy',   name: 'Kő Grafitoptik GO – nagy',   nameDE: 'Stein Graphitoptik GO – groß',  group: 'Kő',           sortOrder: 2 },
  { code: 'ko_aquarel_normal',     name: 'Kő Aquarelle – normál',      nameDE: 'Stein Aquarelle – normal',      group: 'Kő',           sortOrder: 3 },
  { code: 'ko_aquarel_nagy',       name: 'Kő Aquarelle – nagy',        nameDE: 'Stein Aquarelle – groß',        group: 'Kő',           sortOrder: 4 },
  { code: 'belyeg_1_normal',       name: 'Bélyeg egyrétegű – normál',  nameDE: 'Stempel einlagig – normal',     group: 'Bélyeg',       sortOrder: 5 },
  { code: 'belyeg_1_kicsi',        name: 'Bélyeg egyrétegű – kicsi',   nameDE: 'Stempel einlagig – klein',      group: 'Bélyeg',       sortOrder: 6 },
  { code: 'belyeg_2',              name: 'Bélyeg kétrétegű',           nameDE: 'Stempel zweilagig',             group: 'Bélyeg',       sortOrder: 7 },
  { code: 'faszelet_go',           name: 'Faszelet Grafitoptik GO',    nameDE: 'Holzscheibe Graphitoptik GO',   group: 'Fa',           sortOrder: 8 },
  { code: 'fa_nagybetus',          name: 'Fa Nagybetűs',               nameDE: 'Holz Großbuchstaben',           group: 'Fa',           sortOrder: 9 },
  { code: 'templomablak_kicsi',    name: 'Templomablak – kicsi',       nameDE: 'Kirchenfenster – klein',        group: 'Templomablak', sortOrder: 10 },
  { code: 'templomablak_nagy',     name: 'Templomablak – nagy',        nameDE: 'Kirchenfenster – groß',         group: 'Templomablak', sortOrder: 11 },
]

export async function GET() {
  let carriers = await prisma.carrier.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })

  if (carriers.length === 0) {
    await prisma.carrier.createMany({ data: DEFAULT_CARRIERS })
    carriers = await prisma.carrier.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  }

  return NextResponse.json(carriers)
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
    },
  })
  return NextResponse.json(carrier, { status: 201 })
}
