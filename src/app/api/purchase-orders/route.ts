import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const supplierId = searchParams.get('supplierId')

  const orders = await prisma.purchaseOrder.findMany({
    where: supplierId ? { supplierId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  })
  return NextResponse.json(orders)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Generate order number: PO-YYYY-NNNN
  const year = new Date().getFullYear()
  const count = await prisma.purchaseOrder.count({
    where: { number: { startsWith: `PO-${year}-` } },
  })
  const number = `PO-${year}-${String(count + 1).padStart(4, '0')}`

  const order = await prisma.purchaseOrder.create({
    data: {
      number,
      supplierId: body.supplierId,
      status: 'draft',
      notes: body.notes || null,
      items: {
        create: (body.items as { productId: string; quantity: number; unitPrice: number; note?: string }[]).map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 0,
          note: item.note || null,
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  })
  return NextResponse.json(order, { status: 201 })
}
