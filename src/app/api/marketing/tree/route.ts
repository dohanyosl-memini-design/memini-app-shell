import { NextRequest, NextResponse } from 'next/server'
import { buildMarketingTree } from '@/lib/marketingTree'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('archived') === 'true'
  const tree = await buildMarketingTree({ includeArchived })
  return NextResponse.json(tree)
}
