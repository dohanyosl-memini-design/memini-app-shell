import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
        locationCabinet: body.locationCabinet || null,
        locationShelf: body.locationShelf || null,
        locationBox: body.locationBox || null,
        costPrice: parseFloat(body.costPrice) || 0,
        salesPrice: parseFloat(body.salesPrice) || 0,
        minStock: !isNaN(parseInt(body.minStock)) ? parseInt(body.minStock) : 10,
        unit: body.unit || 'db',
        vatRate: parseFloat(body.vatRate) || 19,
        imageUrl: body.imageUrl !== undefined ? (body.imageUrl || null) : undefined,
        priceListEntryId: body.priceListEntryId !== undefined ? (body.priceListEntryId || null) : undefined,
        supplierId: body.supplierId !== undefined ? (body.supplierId || null) : undefined,
      },
    })

    return NextResponse.json(product)
  } catch (err) {
    console.error('Product PUT error:', err)
    return NextResponse.json({ error: 'Mentési hiba – ellenőrizd az adatokat' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.product.update({
    where: { id: params.id },
    data: { active: false },
  })
  return NextResponse.json({ success: true })
}
