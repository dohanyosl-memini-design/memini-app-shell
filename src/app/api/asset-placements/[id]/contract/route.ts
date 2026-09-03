import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@/lib/apiAuth'
import { prepareContract } from '@/lib/assetContract'

export const dynamic = 'force-dynamic'

// A nyomtatható oldal ebből dolgozik — ugyanabból a builderből, mint a DOCX.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  const data = await prepareContract(params.id, user?.email ?? 'human')
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
