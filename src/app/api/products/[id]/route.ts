import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      name: body.name,
      nameDE: body.nameDE || null,
      sku: body.sku,
      description: body.description || null,
      material: body.material || null,
      productType: body.productType || null,
      site: body.site || null,
      city: body.city || null,
      costPrice: parseFloat(body.costPrice) || 0,
      salesPrice: parseFloat(body.salesPrice) || 0,
      minStock: parseInt(body.minStock) || 10,
      unit: body.unit || 'db',
      vatRate: parseFloat(body.vatRate) || 19,
      imageUrl: body.imageUrl !== undefined ? (body.imageUrl || null) : undefined,
    },
  })

  return NextResponse.json(product)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.product.update({
    where: { id: params.id },
    data: { active: false },
  })
  return NextResponse.json({ success: true })
}
