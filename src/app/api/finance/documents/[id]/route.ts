import { NextRequest, NextResponse } from 'next/server'
import { getDocument } from '@/lib/finance/documents'
import { reviewDocument, correctDocument, type Patch } from '@/lib/finance/review'
import { sessionActor } from '@/lib/finance/actor'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await getDocument(params.id)
  return doc ? NextResponse.json(doc) : NextResponse.json({ error: 'Nem található.' }, { status: 404 })
}

const STATUS: Record<string, number> = { not_found: 404, conflict: 409, blocked: 422, needs_confirmation: 422, invalid: 400 }

// Jóváhagyás / elutasítás / duplikátum-megerősítés / adatjavítás. Csak bejelentkezett
// ember teheti; az ügynök (MCP) ezekhez nem fér hozzá.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  try {
    if (body.action === 'correct') {
      const r = await correctDocument(params.id, (body.fields ?? {}) as Patch, actor)
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.message, code: r.code }, { status: STATUS[r.code] ?? 400 })
    }
    if (body.action === 'approve' || body.action === 'reject' || body.action === 'confirm_duplicate') {
      const r = await reviewDocument(params.id, body as never, actor)
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.message, code: r.code }, { status: STATUS[r.code] ?? 400 })
    }
    return NextResponse.json({ error: 'Ismeretlen művelet. Használható: approve | reject | confirm_duplicate | correct.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
