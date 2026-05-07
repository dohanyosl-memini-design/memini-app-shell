import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SEED_DATA = [
  { name: 'Kő Grafitoptik GO – normál', hordozo: 'ko_grafitoptik_normal', costPrice: 1.05, basePrice: 2.87, sortOrder: 1,
    tiers: [{qty:50,m:1},{qty:100,m:0.985},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.94},{qty:1000,m:0.92},{qty:2000,m:0.9}] },
  { name: 'Kő Grafitoptik GO – nagy', hordozo: 'ko_grafitoptik_nagy', costPrice: 1.25, basePrice: 3.15, sortOrder: 2,
    tiers: [{qty:50,m:1},{qty:100,m:0.987},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.94},{qty:1000,m:0.92},{qty:2000,m:0.9}] },
  { name: 'Kő Aquarelle – normál', hordozo: 'ko_aquarel_normal', costPrice: 1.30, basePrice: 3.73, sortOrder: 3,
    tiers: [{qty:50,m:1},{qty:100,m:0.99},{qty:200,m:0.97},{qty:300,m:0.962},{qty:500,m:0.945},{qty:1000,m:0.93},{qty:2000,m:0.9}] },
  { name: 'Fa Nagybetűs (AQ)', hordozo: 'fa_nagybetus', costPrice: 1.25, basePrice: 3.73, sortOrder: 4,
    tiers: [{qty:50,m:1},{qty:100,m:0.986},{qty:200,m:0.973},{qty:300,m:0.962},{qty:500,m:0.945},{qty:1000,m:0.93},{qty:2000,m:0.9}] },
  { name: 'Faszelet Grafitoptik GO', hordozo: 'faszelet_go', costPrice: 1.05, basePrice: 2.87, sortOrder: 5,
    tiers: [{qty:50,m:1},{qty:100,m:0.985},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.94},{qty:1000,m:0.92},{qty:2000,m:0.9}] },
  { name: 'Bélyeg egyrétegű', hordozo: 'belyeg_1_normal', costPrice: 1.10, basePrice: 1.62, sortOrder: 6,
    tiers: [{qty:50,m:1},{qty:100,m:0.99},{qty:200,m:0.98},{qty:300,m:0.96},{qty:500,m:0.95},{qty:1000,m:0.935},{qty:2000,m:0.915}] },
  { name: 'Bélyeg kétrétegű 75×55', hordozo: 'belyeg_2', costPrice: 1.70, basePrice: 2.96, sortOrder: 7,
    tiers: [{qty:50,m:1},{qty:100,m:0.983},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.94},{qty:1000,m:0.93},{qty:2000,m:0.915}] },
  { name: 'Ablak Hűtőmágnes – kicsi', hordozo: 'templomablak_kicsi', costPrice: 1.77, basePrice: 3.87, sortOrder: 8,
    tiers: [{qty:50,m:1},{qty:100,m:0.98},{qty:200,m:0.97},{qty:300,m:0.96},{qty:500,m:0.945},{qty:1000,m:0.92},{qty:2000,m:0.9}] },
]

export async function GET() {
  const entries = await prisma.priceListEntry.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body._seed) {
    const count = await prisma.priceListEntry.count()
    if (count > 0) return NextResponse.json({ ok: false, message: 'Már van adat.' })
    await prisma.priceListEntry.createMany({
      data: SEED_DATA.map(({ tiers, ...rest }) => ({
        ...rest,
        tiers: tiers as object[],
      })),
    })
    return NextResponse.json({ ok: true })
  }

  const entry = await prisma.priceListEntry.create({
    data: {
      name: body.name,
      hordozo: body.hordozo || null,
      costPrice: parseFloat(body.costPrice) || 0,
      basePrice: parseFloat(body.basePrice) || 0,
      tiers: body.tiers || [],
      notes: body.notes || null,
      sortOrder: parseInt(body.sortOrder) || 0,
    },
  })
  return NextResponse.json(entry, { status: 201 })
}
