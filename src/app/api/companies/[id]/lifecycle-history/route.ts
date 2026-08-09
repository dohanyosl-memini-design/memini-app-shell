import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Egy cég teljes életciklus-naplója, legújabb elöl.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const events = await prisma.lifecycleEvent.findMany({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(events)
}
