import { NextRequest, NextResponse } from 'next/server'
import { revokeGrant } from '@/lib/finance/grants'
import { sessionActor } from '@/lib/finance/actor'

export const dynamic = 'force-dynamic'

// Visszavonás (a felhatalmazás nem törlődik, a napló megmarad).
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })
  const r = await revokeGrant(params.id, actor)
  return r.ok ? NextResponse.json(r.grant) : NextResponse.json({ error: r.message }, { status: 404 })
}
