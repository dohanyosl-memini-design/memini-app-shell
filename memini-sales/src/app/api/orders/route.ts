import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { companyId, subtotal, vatAmount, total, items, notes } = body

  if (!items?.length) return NextResponse.json({ error: 'Empty order' }, { status: 400 })

  const count = await prisma.order.count()
  const number = `SO-${String(count + 1).padStart(5, '0')}`

  const order = await prisma.order.create({
    data: {
      number,
      companyId: companyId || null,
      status: 'pending',
      subtotal: subtotal ?? 0,
      vatAmount: vatAmount ?? 0,
      total: total ?? 0,
      currency: 'EUR',
      notes: notes || null,
      items: {
        create: items.map((item: {
          productId?: string; description: string; quantity: number
          unitPrice: number; vatRate: number; total: number
        }) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          total: item.total,
          productId: item.productId || null,
        })),
      },
    },
    select: { id: true, number: true },
  })

  return NextResponse.json({ order }, { status: 201 })
}
