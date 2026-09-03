import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/apiAuth'
import { logAssetEvent } from '@/lib/assets'

export const dynamic = 'force-dynamic'

// Az átadás megerősítése — EMBERI művelet. A piszkozatból „kint" lesz, és a
// megerősítő ember kerül az issuedBy mezőbe (fizikailag ő adta át).
// Arthur ezt a végpontot nem éri el: az /api/mcp-ben nincs ilyen tool.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const actor = user.email ?? 'human'

  const body = await request.json().catch(() => ({}))
  const p = await prisma.assetPlacement.findUnique({ where: { id: params.id } })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (p.status !== 'draft') {
    return NextResponse.json({ error: 'Csak piszkozat erősíthető meg.' }, { status: 400 })
  }

  const issuedAt = body?.issuedAt ? new Date(body.issuedAt) : new Date()
  await prisma.assetPlacement.update({
    where: { id: params.id },
    data: {
      status: 'out',
      issuedAt,
      issuedById: user.id ?? null,
      confirmedAt: new Date(),
      contactId: body?.contactId ?? p.contactId,
    },
  })
  await logAssetEvent(params.id, actor, 'handover_confirmed', undefined, null, { issuedAt })

  const full = await prisma.assetPlacement.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true } },
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  return NextResponse.json(full)
}
