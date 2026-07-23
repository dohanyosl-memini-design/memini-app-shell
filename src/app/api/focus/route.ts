import { NextRequest, NextResponse } from 'next/server'
import { buildFocus } from '@/lib/focus'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days')) || 3
  const result = await buildFocus({ days })
  return NextResponse.json(result)
}
