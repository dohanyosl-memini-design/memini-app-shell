import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULTS: Record<string, number> = {
  annual_revenue:     150000,
  monthly_revenue:    12500,
  active_partners:    50,
  new_partners_month: 3,
  avg_order_value:    3000,
  reorder_rate:       40,
}

export async function GET() {
  const rows = await prisma.kpiTarget.findMany()
  const map: Record<string, number> = { ...DEFAULTS }
  for (const r of rows) map[r.key] = r.value
  return NextResponse.json(map)
}

export async function POST(request: NextRequest) {
  const body: Record<string, number> = await request.json()
  const ops = Object.entries(body).map(([key, value]) =>
    prisma.kpiTarget.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  )
  await prisma.$transaction(ops)
  const rows = await prisma.kpiTarget.findMany()
  const map: Record<string, number> = { ...DEFAULTS }
  for (const r of rows) map[r.key] = r.value
  return NextResponse.json(map)
}
