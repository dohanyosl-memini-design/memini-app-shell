import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PRODUCT_SELECT = {
  id: true,
  name: true,
  nameDE: true,
  sku: true,
  description: true,
  material: true,
  productType: true,
  city: true,
  salesPrice: true,
  unit: true,
  vatRate: true,
  imageUrl: true,
  priceListEntryId: true,
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city')
  const search = searchParams.get('search')
  const partnerId = searchParams.get('partnerId')

  // --- Smart mode: partner selected ---
  if (partnerId && !search) {
    const company = await prisma.company.findUnique({
      where: { id: partnerId },
      select: { city: true, classification: true },
    })

    // 1. Previously ordered products (grouped by frequency)
    const prevGroups = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { companyId: partnerId },
        productId: { not: null },
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
    })

    const prevIds = prevGroups.map((g) => g.productId).filter(Boolean) as string[]
    const prevCountMap = new Map(prevGroups.map((g) => [g.productId, g._count.productId]))

    const prevProducts = prevIds.length
      ? await prisma.product.findMany({
          where: { id: { in: prevIds }, active: true },
          select: PRODUCT_SELECT,
        })
      : []

    // Sort by order frequency and attach count
    const prevProductsSorted = prevIds
      .map((id) => {
        const p = prevProducts.find((p) => p.id === id)
        if (!p) return null
        return { ...p, orderCount: prevCountMap.get(id) ?? 1 }
      })
      .filter(Boolean) as (typeof prevProducts[number] & { orderCount: number })[]

    // 2. City products not yet ordered
    const cityProducts =
      company?.city
        ? await prisma.product.findMany({
            where: {
              active: true,
              city: company.city,
              id: prevIds.length ? { notIn: prevIds } : undefined,
            },
            orderBy: { name: 'asc' },
            select: PRODUCT_SELECT,
          })
        : []

    const cityProductIds = new Set(cityProducts.map((p) => p.id))
    const excludedIds = [...prevIds, ...Array.from(cityProductIds)]

    // 3. Upsell: products frequently ordered by similar companies
    const upsellSections: (typeof prevProducts[number] & { orderCount?: number })[] = []
    if (company) {
      const similarCompanies = await prisma.company.findMany({
        where: {
          id: { not: partnerId },
          OR: [
            company.city ? { city: company.city } : { id: '' },
            company.classification ? { classification: company.classification } : { id: '' },
          ].filter((c) => Object.keys(c).length > 0 && !('id' in c && c.id === '')),
        },
        select: { id: true },
        take: 150,
      })

      const similarIds = similarCompanies.map((c) => c.id)

      if (similarIds.length > 0) {
        const upsellGroups = await prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: { companyId: { in: similarIds } },
            productId: {
              not: null,
              notIn: excludedIds.length ? excludedIds : undefined,
            },
          },
          _count: { productId: true },
          orderBy: { _count: { productId: 'desc' } },
          take: 20,
        })

        const upsellIds = upsellGroups.map((g) => g.productId).filter(Boolean) as string[]
        const upsellCountMap = new Map(upsellGroups.map((g) => [g.productId, g._count.productId]))

        if (upsellIds.length) {
          const upsellProducts = await prisma.product.findMany({
            where: { id: { in: upsellIds }, active: true },
            select: PRODUCT_SELECT,
          })
          const sorted = upsellIds
            .map((id) => {
              const p = upsellProducts.find((p) => p.id === id)
              if (!p) return null
              return { ...p, orderCount: upsellCountMap.get(id) }
            })
            .filter(Boolean) as (typeof prevProducts[number] & { orderCount?: number })[]
          upsellSections.push(...sorted)
        }
      }
    }

    return NextResponse.json({
      smart: true,
      sections: [
        {
          type: 'previous',
          label: 'Korábbi rendelések',
          products: prevProductsSorted,
        },
        {
          type: 'city',
          label: company?.city ? `${company.city} — helyi termékek` : 'Helyi termékek',
          products: cityProducts,
        },
        {
          type: 'upsell',
          label: 'Ajánlott',
          products: upsellSections,
        },
      ].filter((s) => s.products.length > 0),
    })
  }

  // --- Regular mode ---
  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(city && city !== 'all' ? { city } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { nameDE: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { material: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    select: PRODUCT_SELECT,
  })

  const cities = await prisma.product.findMany({
    where: { active: true, city: { not: null } },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })

  return NextResponse.json({
    smart: false,
    products,
    cities: cities.map((c) => c.city).filter(Boolean),
  })
}
