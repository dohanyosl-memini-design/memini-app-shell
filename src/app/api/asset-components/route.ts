import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body?.assetTypeId) {
    return NextResponse.json({ error: 'A kellék (assetTypeId) kötelező.' }, { status: 400 })
  }
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'A név kötelező.' }, { status: 400 })
  }
  const component = await prisma.assetComponent.create({
    data: {
      assetTypeId: body.assetTypeId,
      name: body.name.trim(),
      nameDE: body.nameDE?.trim() || null,
      imageUrl: body.imageUrl || null,
      defaultValue: parseFloat(body.defaultValue) || 0,
      defaultQuantity: parseInt(body.defaultQuantity) > 0 ? parseInt(body.defaultQuantity) : 1,
      sortOrder: parseInt(body.sortOrder) || 0,
    },
  })
  return NextResponse.json(component, { status: 201 })
}
