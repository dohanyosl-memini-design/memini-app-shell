import { NextRequest, NextResponse } from 'next/server'
import { getMnbRates } from '@/lib/mnb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const result = await getMnbRates(date)
  if (!result) return NextResponse.json({ error: 'MNB árfolyam nem elérhető' }, { status: 503 })
  return NextResponse.json(result)
}
