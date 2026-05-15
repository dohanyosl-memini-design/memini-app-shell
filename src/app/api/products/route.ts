import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const material = searchParams.get('material') || ''

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { site: { contains: search } },
        ],
      } : {}),
      ...(material ? { material: { equals: material } } : {}),
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const product = await prisma.product.create({
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
      stock: parseInt(body.stock) || 0,
      minStock: parseInt(body.minStock) || 10,
      unit: body.unit || 'db',
      vatRate: parseFloat(body.vatRate) || 19,
      imageUrl: body.imageUrl || null,
      priceListEntryId: body.priceListEntryId || null,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
