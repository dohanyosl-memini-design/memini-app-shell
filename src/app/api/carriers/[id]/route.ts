import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const carrier = await prisma.carrier.update({
    where: { id: params.id },
    data: {
      code: body.code,
      name: body.name,
      nameDE: body.nameDE || null,
      group: body.group || null,
      sortOrder:  body.sortOrder  ?? undefined,
      supplierId: body.supplierId !== undefined ? (body.supplierId || null) : undefined,
    },
  })
  return NextResponse.json(carrier)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.carrier.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
