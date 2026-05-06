import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const movements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(movements)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const movement = await prisma.stockMovement.create({
    data: {
      type: body.type,
      quantity: parseInt(body.quantity),
      note: body.note || null,
      productId: body.productId,
    },
    include: { product: true },
  })

  const delta = body.type === 'in' ? parseInt(body.quantity) :
                body.type === 'out' ? -parseInt(body.quantity) :
                parseInt(body.quantity)

  await prisma.product.update({
    where: { id: body.productId },
    data: { stock: { increment: delta } },
  })

  return NextResponse.json(movement, { status: 201 })
}
