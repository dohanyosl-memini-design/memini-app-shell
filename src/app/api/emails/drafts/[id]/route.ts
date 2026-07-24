import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Tervezet állapotának módosítása — a jóváhagyási lánc kézi lépése.
//   approve  → 'approved' (küldésre sorba állítva; a tényleges SMTP-kiküldés a
//              következő szelet, ezért itt még NEM megy ki levél)
//   discard  → 'discarded'
//   reopen   → 'draft'
// A kimenő csővezeték egységes: kézi, agent és kampány tervezet is ezen megy át.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await request.json().catch(() => ({}))
  const action = body?.action as string | undefined

  const draft = await prisma.emailDraft.findUnique({ where: { id: params.id } })
  if (!draft) {
    return NextResponse.json({ error: 'A tervezet nem található.' }, { status: 404 })
  }
  if (draft.status === 'sent') {
    return NextResponse.json({ error: 'Ez a levél már elment, nem módosítható.' }, { status: 409 })
  }

  const session = await getServerSession(authOptions).catch(() => null)
  const actor = session?.user?.email ?? null

  const next =
    action === 'approve' ? { status: 'approved', approvedBy: actor }
    : action === 'discard' ? { status: 'discarded' }
    : action === 'reopen' ? { status: 'draft', approvedBy: null }
    : null

  if (!next) {
    return NextResponse.json(
      { error: 'Ismeretlen művelet. Használható: approve | discard | reopen.' },
      { status: 400 },
    )
  }

  const updated = await prisma.emailDraft.update({
    where: { id: params.id },
    data: next,
    select: { id: true, status: true, approvedBy: true },
  })

  return NextResponse.json({
    ok: true,
    draft: updated,
    note: action === 'approve'
      ? 'Jóváhagyva és küldésre sorba állítva. A tényleges kiküldés a következő szeletben (SMTP-bekötés) történik.'
      : undefined,
  })
}
