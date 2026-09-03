import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/apiAuth'
import { computeValues, logAssetEvent } from '@/lib/assets'

export const dynamic = 'force-dynamic'

const placementInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  issuedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.AssetPlacementInclude

// A lista minden átadáshoz mellékeli a számított értékeket (kint / hiány / össz).
function shape<T extends { items: Parameters<typeof computeValues>[0] }>(p: T) {
  return { ...p, values: computeValues(p.items) }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') || undefined
  const statusParam = searchParams.get('status') || undefined
  const outOnly = searchParams.get('outOnly') === 'true'
  const includeDrafts = searchParams.get('includeDrafts') !== 'false'

  const where: Record<string, unknown> = {}
  if (companyId) where.companyId = companyId
  if (statusParam) where.status = { in: statusParam.split(',') }
  else if (outOnly) where.status = { in: ['out', 'partially_returned'] }
  else if (!includeDrafts) where.status = { notIn: ['draft', 'discarded'] }

  const placements = await prisma.assetPlacement.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: placementInclude,
  })
  return NextResponse.json(placements.map(shape))
}

// Létrehozás. A webes felület mindig bejelentkezett ember — ezért itt a
// `confirm:true` egyből „kint" státuszt ad (issuedBy = a megerősítő ember).
// Arthur NEM ezt a route-ot hívja: a piszkozatait az /api/mcp hozza létre,
// source:'agent', status:'draft' — azt itt a /confirm végpont zárja emberrel.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const user = await currentUser()
  const actor = user?.email ?? 'human'

  if (!body?.companyId) {
    return NextResponse.json({ error: 'A partner (companyId) kötelező.' }, { status: 400 })
  }
  const inputAssets: Array<{
    assetTypeId: string
    quantity?: number
    components?: Array<{ componentId: string; quantity?: number }>
  }> = Array.isArray(body.items) ? body.items : []
  if (inputAssets.length === 0) {
    return NextResponse.json({ error: 'Legalább egy kelléket ki kell választani.' }, { status: 400 })
  }

  // Katalógus a pillanatképekhez — a név és az érték kiadáskor rögzül, hogy a
  // későbbi katalógus-módosítás ne írja át a múltat.
  const typeIds = inputAssets.map(a => a.assetTypeId)
  const types = await prisma.assetType.findMany({
    where: { id: { in: typeIds } },
    include: { components: true },
  })
  const typeMap = new Map(types.map(t => [t.id, t]))

  // agent-forrás sosem erősíthet meg magától; a webes ember igen.
  const source = body.source === 'agent' || body.source === 'migration' ? body.source : 'human'
  const confirmNow = !!body.confirm && source === 'human'

  const placement = await prisma.$transaction(async (tx) => {
    const p = await tx.assetPlacement.create({
      data: {
        companyId: body.companyId,
        contactId: body.contactId || null,
        notes: body.notes?.trim() || null,
        source,
        status: confirmNow ? 'out' : 'draft',
        issuedAt: confirmNow ? new Date() : null,
        issuedById: confirmNow ? user?.id ?? null : null,
        confirmedAt: confirmNow ? new Date() : null,
      },
    })

    let sort = 0
    for (const a of inputAssets) {
      const type = typeMap.get(a.assetTypeId)
      if (!type) continue
      const qty = Number(a.quantity) > 0 ? Math.floor(Number(a.quantity)) : 1
      const parent = await tx.assetPlacementItem.create({
        data: {
          placementId: p.id,
          kind: 'asset',
          assetTypeId: type.id,
          nameSnapshot: type.nameDE || type.name,
          unitValueSnapshot: type.defaultValue,
          quantity: qty,
          sortOrder: sort++,
        },
      })
      const compMap = new Map(type.components.map(c => [c.id, c]))
      const chosen = Array.isArray(a.components) ? a.components : []
      let cSort = 0
      for (const c of chosen) {
        const comp = compMap.get(c.componentId)
        if (!comp) continue
        const cQty = Number(c.quantity) > 0 ? Math.floor(Number(c.quantity)) : 1
        await tx.assetPlacementItem.create({
          data: {
            placementId: p.id,
            parentItemId: parent.id,
            kind: 'component',
            componentId: comp.id,
            nameSnapshot: comp.nameDE || comp.name,
            unitValueSnapshot: comp.defaultValue,
            quantity: cQty,
            sortOrder: cSort++,
          },
        })
      }
    }
    return p
  })

  await logAssetEvent(placement.id, actor, 'created', undefined, null, { source, confirmNow })
  if (confirmNow) {
    await logAssetEvent(placement.id, actor, 'handover_confirmed')
  }

  const full = await prisma.assetPlacement.findUnique({
    where: { id: placement.id },
    include: placementInclude,
  })
  return NextResponse.json(full ? shape(full) : placement, { status: 201 })
}
