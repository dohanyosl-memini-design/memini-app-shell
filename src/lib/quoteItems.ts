/**
 * Ajánlat-tételek összegzése és normalizálása.
 *
 * Külön modul, mert a Next route-fájlok csak útvonal-kezelőket exportálhatnak
 * — a POST és a PUT viszont ugyanezt a számolást használja.
 */

export interface QuoteItemInput {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  productId?: string
  isDiscount?: boolean
}

/**
 * A kedvezmény-sorok negatív egységárral szerepelnek és 0% áfát visznek,
 * pontosan úgy, mint a számlánál — így az összeg magától helyes.
 */
export function summarize(items: QuoteItemInput[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  return { subtotal, vatAmount, total: subtotal + vatAmount }
}

export function itemRows(items: QuoteItemInput[]) {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    vatRate: i.vatRate,
    total: i.quantity * i.unitPrice * (1 + i.vatRate / 100),
    productId: i.productId || null,
    isDiscount: i.isDiscount ?? false,
  }))
}
