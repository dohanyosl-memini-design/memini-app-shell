import { NextRequest, NextResponse } from 'next/server'
import { createGrant, listGrants, isActive } from '@/lib/finance/grants'
import { sessionActor } from '@/lib/finance/actor'

export const dynamic = 'force-dynamic'

export async function GET() {
  const grants = await listGrants()
  return NextResponse.json({ grants: grants.map((g) => ({ ...g, active: isActive(g) })) })
}

// Felhatalmazás létrehozása: CSAK bejelentkezett ember teheti. Az MCP-ről nem érhető el.
export async function POST(request: NextRequest) {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const b = await request.json().catch(() => ({})) as Record<string, unknown>
  const r = await createGrant({
    scope: b.scope as 'batch' | 'window', batchId: (b.batchId as string) ?? null, hours: Number(b.hours),
    maxGrossCents: b.maxGross != null ? Math.round(Number(b.maxGross) * 100) : undefined,
    allowWaiveOriginal: b.allowWaiveOriginal === true, note: typeof b.note === 'string' ? b.note : undefined,
  }, actor)
  return r.ok ? NextResponse.json(r.grant, { status: 201 }) : NextResponse.json({ error: r.message }, { status: 400 })
}
