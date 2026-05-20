import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '200')

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
    },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(movements)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const qty = parseInt(body.quantity)

  const product = await prisma.product.findUnique({ where: { id: body.productId } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let delta: number
  let storedQty: number

  if (body.type === 'adjustment') {
    // qty = new absolute stock level
    delta = qty - product.stock
    storedQty = Math.abs(delta)
  } else {
    storedQty = qty
    delta = body.type === 'in' ? qty : -qty
  }

  const movement = await prisma.stockMovement.create({
    data: {
      type: body.type,
      quantity: storedQty,
      note: body.note || null,
      supplier: body.supplier || null,
      reference: body.reference || null,
      productId: body.productId,
    },
    include: { product: true },
  })

  await prisma.product.update({
    where: { id: body.productId },
    data: { stock: { increment: delta } },
  })

  return NextResponse.json(movement, { status: 201 })
}
