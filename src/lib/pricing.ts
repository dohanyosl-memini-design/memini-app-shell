/**
 * Árlista-sávok kiértékelése.
 *
 * Az árlistában hordozónként van egy alapár (basePrice) és egy mennyiségi
 * sávtábla: [{ qty: 50, m: 1 }, { qty: 100, m: 0.985 }, ...]. A sáv szorzója
 * a rendelt darabszámtól függ — az alapár a legkisebb sávra érvényes, nagyobb
 * mennyiségnél olcsóbb az egységár.
 *
 * Ez a modul azért van külön, mert három helyről kell ugyanaz az eredmény:
 * az MCP árazó tool, az ajánlat-készítés ellenőrzése és a felület.
 */

export interface PriceTier {
  qty: number
  m: number
}

export interface TierPrice {
  /** A sáv, amibe a mennyiség esik (a legmagasabb, aminek a qty-ja <= mennyiség). */
  tierQty: number
  multiplier: number
  /** Kerekített nettó egységár EUR-ban. */
  unitPrice: number
  /** Az alapárhoz képesti kedvezmény százalékban, tájékoztatásul. */
  discountPercent: number
}

/** A tiers mező Json-ként jön a DB-ből — óvatosan olvassuk ki. */
export function parseTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is PriceTier =>
      typeof t === 'object' && t !== null &&
      typeof (t as PriceTier).qty === 'number' &&
      typeof (t as PriceTier).m === 'number')
    .sort((a, b) => a.qty - b.qty)
}

/**
 * Egységár adott mennyiséghez. A legkisebb sáv alatti mennyiségnél az alapár
 * érvényes (nincs felár), a legnagyobb sáv fölött a legnagyobb kedvezmény.
 */
export function priceForQuantity(basePrice: number, rawTiers: unknown, quantity: number): TierPrice {
  const tiers = parseTiers(rawTiers)
  let applied: PriceTier = { qty: 0, m: 1 }
  for (const tier of tiers) {
    if (quantity >= tier.qty) applied = tier
  }
  const unitPrice = Math.round(basePrice * applied.m * 100) / 100
  return {
    tierQty: applied.qty,
    multiplier: applied.m,
    unitPrice,
    discountPercent: Math.round((1 - applied.m) * 1000) / 10,
  }
}

/**
 * Egy ajánlat/megrendelés tételének összevetése az árlistával.
 * Nem tilt: visszaadja az eltérést, hogy a hívó jelezhesse. Nálunk az egyedi
 * megállapodás normális — csak látszódnia kell, hogy eltértünk a listától.
 */
export interface PriceDeviation {
  description: string
  quantity: number
  givenUnitPrice: number
  listUnitPrice: number
  tierQty: number
  /** Pozitív: a megadott ár drágább a listaárnál. */
  differenceEur: number
  differencePercent: number
}

/**
 * Tételsor összevetése az árlistával, a termék hordozója alapján.
 * Csak azokat a tételeket tudja ellenőrizni, amikhez tartozik termék —
 * a szabad szövegű sorokat kihagyja.
 */
export async function checkItemsAgainstPriceList(
  items: { description: string; quantity: number; unitPrice: number; productId?: string }[],
): Promise<PriceDeviation[]> {
  const { prisma } = await import('@/lib/prisma')
  const productIds = items.map(i => i.productId).filter((id): id is string => !!id)
  if (productIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, material: true, priceListEntryId: true },
  })
  const productById = new Map(products.map(p => [p.id, p]))

  const entryIds = products.map(p => p.priceListEntryId).filter((id): id is string => !!id)
  const materials = products.map(p => p.material).filter((m): m is string => !!m)
  const entries = await prisma.priceListEntry.findMany({
    where: { OR: [{ id: { in: entryIds } }, { hordozo: { in: materials } }] },
    select: { id: true, hordozo: true, basePrice: true, tiers: true },
  })
  const entryById = new Map(entries.map(e => [e.id, e]))
  const entryByHordozo = new Map(entries.map(e => [e.hordozo ?? '', e]))

  const deviations: PriceDeviation[] = []
  for (const item of items) {
    if (!item.productId) continue
    const product = productById.get(item.productId)
    if (!product) continue
    const entry =
      (product.priceListEntryId ? entryById.get(product.priceListEntryId) : undefined) ??
      (product.material ? entryByHordozo.get(product.material) : undefined)
    if (!entry) continue

    const deviation = checkDeviation(
      item.description || product.name,
      item.quantity,
      item.unitPrice,
      entry.basePrice,
      entry.tiers,
    )
    if (deviation) deviations.push(deviation)
  }
  return deviations
}

export function checkDeviation(
  description: string,
  quantity: number,
  givenUnitPrice: number,
  basePrice: number,
  rawTiers: unknown,
): PriceDeviation | null {
  const list = priceForQuantity(basePrice, rawTiers, quantity)
  const diff = Math.round((givenUnitPrice - list.unitPrice) * 100) / 100
  // 1 centnél kisebb eltérés kerekítési zaj, nem érdemes jelezni.
  if (Math.abs(diff) < 0.01) return null
  return {
    description,
    quantity,
    givenUnitPrice,
    listUnitPrice: list.unitPrice,
    tierQty: list.tierQty,
    differenceEur: diff,
    differencePercent: list.unitPrice === 0
      ? 0
      : Math.round((diff / list.unitPrice) * 1000) / 10,
  }
}
