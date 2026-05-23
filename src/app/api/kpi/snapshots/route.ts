import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshots = await prisma.kpiSnapshot.findMany({
    orderBy: { month: 'asc' },
  })
  return NextResponse.json(snapshots)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const month: string = body.month // "2026-05"
  const data = body.data

  const snapshot = await prisma.kpiSnapshot.upsert({
    where: { month },
    update: { data },
    create: { month, data },
  })
  return NextResponse.json(snapshot)
}
