import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Kellék-katalógus. Alapból csak az aktív kellékeket adja, alkatrészeikkel.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const types = await prisma.assetType.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      components: {
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
  })
  return NextResponse.json(types)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'A név kötelező.' }, { status: 400 })
  }
  const type = await prisma.assetType.create({
    data: {
      name: body.name.trim(),
      nameDE: body.nameDE?.trim() || null,
      category: body.category || null,
      defaultValue: parseFloat(body.defaultValue) || 0,
      imageUrl: body.imageUrl || null,
      contractAddendumDe: body.contractAddendumDe?.trim() || null,
      sortOrder: parseInt(body.sortOrder) || 0,
    },
    include: { components: true },
  })
  return NextResponse.json(type, { status: 201 })
}
