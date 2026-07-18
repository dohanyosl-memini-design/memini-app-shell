import { NextRequest, NextResponse } from 'next/server'
import { buildGoalTree } from '@/lib/goalProgress'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('archived') === 'true'
  const tree = await buildGoalTree({ includeArchived })
  return NextResponse.json(tree)
}
