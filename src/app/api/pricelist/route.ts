import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STD  = (m1:number,m2:number,m3:number,m4:number,m5:number,m6:number) =>
  [{qty:50,m:1},{qty:100,m:m1},{qty:200,m:m2},{qty:300,m:m3},{qty:500,m:m4},{qty:1000,m:m5},{qty:2000,m:m6}]

const SMALL = (m1:number,m2:number,m3:number,m4:number,m5:number,m6:number) =>
  [{qty:5,m:1},{qty:10,m:m1},{qty:20,m:m2},{qty:30,m:m3},{qty:50,m:m4},{qty:100,m:m5},{qty:200,m:m6}]

const SEED_DATA = [
  // ── Kő ────────────────────────────────────────────────────────────────────
  { sortOrder:1,  hordozo:'ko_grafitoptik_normal', costPrice:1.05, basePrice:2.87,
    name:'Kő Grafitoptik GO – normál',
    tiers: STD(0.985,0.97,0.96,0.94,0.92,0.9) },
  { sortOrder:2,  hordozo:'ko_grafitoptik_nagy',   costPrice:1.25, basePrice:3.15,
    name:'Kő Grafitoptik GO – nagy',
    tiers: STD(0.987,0.97,0.96,0.94,0.92,0.9) },
  { sortOrder:3,  hordozo:'ko_aquarel_normal',      costPrice:1.30, basePrice:3.73,
    name:'Kő Aquarelle – normál',
    tiers: STD(0.99,0.97,0.962,0.945,0.93,0.9) },
  { sortOrder:4,  hordozo:'ko_aquarel_nagy',         costPrice:1.50, basePrice:4.10,
    name:'Kő Aquarelle – nagy',
    tiers: STD(0.99,0.97,0.962,0.945,0.93,0.9) },

  // ── Bélyeg ────────────────────────────────────────────────────────────────
  { sortOrder:10, hordozo:'belyeg_1_normal',  costPrice:1.10, basePrice:1.62,
    name:'Bélyeg egyrétegű – normál',
    tiers: STD(0.99,0.98,0.96,0.95,0.935,0.915) },
  { sortOrder:11, hordozo:'belyeg_1_kicsi',   costPrice:1.00, basePrice:1.45,
    name:'Bélyeg egyrétegű – kicsi',
    tiers: STD(0.99,0.98,0.96,0.95,0.935,0.915) },
  { sortOrder:12, hordozo:'belyeg_2',          costPrice:1.70, basePrice:2.96,
    name:'Bélyeg kétrétegű 75×55',
    tiers: STD(0.983,0.97,0.96,0.94,0.93,0.915) },

  // ── Fa / Faszelet ─────────────────────────────────────────────────────────
  { sortOrder:20, hordozo:'faszelet_go',    costPrice:1.05, basePrice:2.87,
    name:'Faszelet Grafitoptik GO',
    tiers: STD(0.985,0.97,0.96,0.94,0.92,0.9) },
  { sortOrder:21, hordozo:'fa_nagybetus',   costPrice:1.25, basePrice:3.73,
    name:'Fa Nagybetűs (AQ)',
    tiers: STD(0.986,0.973,0.962,0.945,0.93,0.9) },
  { sortOrder:22, hordozo:null, costPrice:2.80, basePrice:5.49,
    name:'Antikoptik Fa Kép GO – Natur 13×9 cm',
    tiers: SMALL(0.99,0.982,0.97,0.95,0.935,0.9) },
  { sortOrder:23, hordozo:null, costPrice:3.00, basePrice:6.67,
    name:'Antikoptik Fa Kép AQ – Színes 13×9 cm',
    tiers: SMALL(0.99,0.982,0.97,0.95,0.935,0.9) },
  { sortOrder:24, hordozo:null, costPrice:0.50, basePrice:3.09,
    name:'Natur Lézervágott Hűtőmágnes',
    tiers: STD(0.99,0.98,0.96,0.94,0.92,0.9) },

  // ── Templomablak / Ablak ──────────────────────────────────────────────────
  { sortOrder:30, hordozo:'templomablak_kicsi', costPrice:1.77, basePrice:3.87,
    name:'Ablak Hűtőmágnes – kicsi',
    tiers: STD(0.98,0.97,0.96,0.945,0.92,0.9) },
  { sortOrder:31, hordozo:'templomablak_nagy',  costPrice:1.80, basePrice:4.27,
    name:'Fenster Kühlschrankmagnet 12,5×5,5',
    tiers: STD(0.98,0.97,0.953,0.94,0.92,0.9) },
  { sortOrder:32, hordozo:'templomablak_nagy',  costPrice:1.80, basePrice:4.47,
    name:'Fenster Kühlschrankmagnet 15×5,5',
    tiers: STD(0.98,0.97,0.953,0.94,0.92,0.9) },
  { sortOrder:33, hordozo:'templomablak_kicsi', costPrice:1.80, basePrice:3.87,
    name:'Rund Fenster Kühlschrankmagnet',
    tiers: STD(0.98,0.97,0.96,0.945,0.92,0.9) },

  // ── Egyéb termékek ────────────────────────────────────────────────────────
  { sortOrder:40, hordozo:null, costPrice:1.10, basePrice:2.89,
    name:'Lézervágott kulcstartó – AQ Színes',
    tiers: STD(0.985,0.973,0.955,0.94,0.92,0.9) },
  { sortOrder:41, hordozo:null, costPrice:1.06, basePrice:2.06,
    name:'Kork Hűtőmágnes',
    tiers: STD(0.98,0.97,0.953,0.94,0.92,0.9) },
  { sortOrder:42, hordozo:null, costPrice:0.90, basePrice:2.55,
    name:'Bambusztoll',
    tiers: STD(0.99,0.98,0.96,0.94,0.92,0.9) },
  { sortOrder:43, hordozo:null, costPrice:1.60, basePrice:3.97,
    name:'Weihnachtsschmuck rund',
    tiers: STD(0.98,0.97,0.953,0.94,0.92,0.9) },
  { sortOrder:44, hordozo:null, costPrice:2.06, basePrice:3.75,
    name:'3D Nyomtatott termék',
    tiers: STD(0.985,0.98,0.975,0.965,0.96,0.95) },
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
    const existing = new Set(
      (await prisma.priceListEntry.findMany({ select: { name: true } })).map(e => e.name)
    )
    const toCreate = SEED_DATA.filter(e => !existing.has(e.name))
    if (toCreate.length === 0) return NextResponse.json({ ok: true, added: 0 })
    await prisma.priceListEntry.createMany({
      data: toCreate.map(({ tiers, ...rest }) => ({ ...rest, tiers })),
    })
    return NextResponse.json({ ok: true, added: toCreate.length })
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
