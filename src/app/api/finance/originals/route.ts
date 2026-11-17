import { NextRequest, NextResponse } from 'next/server'
import { attachOriginal } from '@/lib/finance/originals'
import { sessionActor } from '@/lib/finance/actor'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Egy eredeti fájl feltöltése. A szerver maga számolja ki az SHA-256-ot, és ez alapján
// keresi meg a rekordot — nem a ChatGPT által megadott hash-ben bízunk.
// Fájlonként egy kérés (a Vercel kérés-mérete ~4,5 MB, a határ 4 MB).
export async function POST(request: NextRequest) {
  const actor = await sessionActor()
  if (!actor) return NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'Érvénytelen feltöltés.' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Hiányzik a fájl.' }, { status: 400 })
  const adoptFor = (form.get('adopt_for') as string | null) || null

  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const r = await attachOriginal({ filename: file.name, bytes, actor, adoptFor })
    return NextResponse.json({ filename: file.name, ...r }, { status: r.outcome === 'rejected' ? 422 : 200 })
  } catch (e) {
    return NextResponse.json({ filename: file.name, outcome: 'error', reason: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
