import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/apiAuth'
import { deriveStatus, computeValues, logAssetEvent } from '@/lib/assets'

export const dynamic = 'force-dynamic'

// Visszavételezés — EMBERI művelet, tétel-szinten. A body soronként a KUMULATÍV
// összeget adja meg (mennyi jött összesen vissza / hiányzik), így újraküldésre is
// idempotens. Az átadás státusza a tételekből SZÁMÍTÓDIK (deriveStatus), nem
// kézzel állítjuk. Amikor minden lezárult, closedBy = a visszavevő ember.
//
// Arthur ezt a végpontot nem éri el: az /api/mcp-ben nincs return tool, és az
// Arthurnak adott író-műveletek a status mezőt sem írhatják.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const actor = user.email ?? 'human'

  const body = await request.json().catch(() => ({}))
  const rows: Array<{ itemId: string; returnedQty?: number; lostQty?: number }> =
    Array.isArray(body.items) ? body.items : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nincs megadva visszavett tétel.' }, { status: 400 })
  }

  const placement = await prisma.assetPlacement.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!placement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (placement.status !== 'out' && placement.status !== 'partially_returned') {
    return NextResponse.json(
      { error: 'Visszavételezni csak kint lévő átadásból lehet.' },
      { status: 400 },
    )
  }

  const itemMap = new Map(placement.items.map(i => [i.id, i]))
  let anyLost = false

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const item = itemMap.get(row.itemId)
      if (!item) continue
      const returnedQty = clamp(Number(row.returnedQty ?? item.returnedQty), 0, item.quantity)
      const maxLost = item.quantity - returnedQty
      const lostQty = clamp(Number(row.lostQty ?? item.lostQty), 0, maxLost)
      if (lostQty > 0) anyLost = true
      const changed = returnedQty !== item.returnedQty || lostQty !== item.lostQty
      await tx.assetPlacementItem.update({
        where: { id: item.id },
        data: {
          returnedQty,
          lostQty,
          returnedAt: changed ? new Date() : item.returnedAt,
        },
      })
      // helyi tükrözés a deriváláshoz
      item.returnedQty = returnedQty
      item.lostQty = lostQty
    }
  })

  const items = Array.from(itemMap.values())
  const status = deriveStatus(items)
  const terminal = status === 'returned' || status === 'closed_with_loss'

  await prisma.assetPlacement.update({
    where: { id: params.id },
    data: {
      status,
      closedAt: terminal ? new Date() : null,
      closedById: terminal ? user.id ?? null : null,
    },
  })

  await logAssetEvent(params.id, actor, 'returned', undefined, null, {
    status,
    values: computeValues(items),
  })
  if (anyLost) {
    await logAssetEvent(params.id, actor, 'marked_lost', undefined, null, {
      lostValue: computeValues(items).lostValue,
    })
  }

  const full = await prisma.assetPlacement.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  return NextResponse.json(full ? { ...full, values: computeValues(full.items) } : null)
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
}
