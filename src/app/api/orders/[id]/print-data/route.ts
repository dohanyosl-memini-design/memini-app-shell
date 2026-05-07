import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      company: {
        select: {
          id: true, name: true, address: true, city: true, region: true,
          country: true, phone: true, email: true, vatId: true, customerNumber: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, nameDE: true, sku: true, imageUrl: true,
              locationCabinet: true, locationShelf: true, locationBox: true,
            },
          },
        },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}
