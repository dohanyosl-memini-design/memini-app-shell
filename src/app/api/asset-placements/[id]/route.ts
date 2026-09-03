import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/apiAuth'
import { computeValues, logAssetEvent } from '@/lib/assets'

export const dynamic = 'force-dynamic'

const placementInclude = {
  company: { select: { id: true, name: true, address: true, zip: true, city: true, country: true, vatId: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  issuedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  events: { orderBy: { createdAt: 'desc' }, take: 50 },
} satisfies Prisma.AssetPlacementInclude

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const p = await prisma.assetPlacement.findUnique({
    where: { id: params.id },
    include: placementInclude,
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...p, values: computeValues(p.items) })
}

// Csak a megjegyzés és a kapcsolattartó szerkeszthető így. A tétel-összetétel
// nem: piszkozatnál elvetés + újrarögzítés a mód, kihelyezés után pedig a
// visszavétel az egyetlen legitim változás (a szerződés-zárolás miatt).
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const user = await currentUser()
  const actor = user?.email ?? 'human'

  const before = await prisma.assetPlacement.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null
  if (body.contactId !== undefined) data.contactId = body.contactId || null

  await prisma.assetPlacement.update({ where: { id: params.id }, data })
  if (before.notes !== (data.notes ?? before.notes)) {
    await logAssetEvent(params.id, actor, 'updated', 'notes', before.notes, data.notes ?? null)
  }

  const p = await prisma.assetPlacement.findUnique({ where: { id: params.id }, include: placementInclude })
  return NextResponse.json(p ? { ...p, values: computeValues(p.items) } : null)
}

// A kuka gomb piszkozatot vet el (status:discarded). Ami már KINT van, azt nem
// lehet törölni — azt vissza kell venni. Ez a 4. alapszabály védelme.
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  const actor = user?.email ?? 'human'
  const p = await prisma.assetPlacement.findUnique({ where: { id: params.id } })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (p.status !== 'draft') {
    return NextResponse.json(
      { error: 'Csak piszkozat vethető el. Ami kint van, azt vissza kell venni.' },
      { status: 400 },
    )
  }
  await prisma.assetPlacement.update({ where: { id: params.id }, data: { status: 'discarded' } })
  await logAssetEvent(params.id, actor, 'discarded')
  return NextResponse.json({ ok: true })
}
