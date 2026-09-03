// Kihelyezett eszközök — tiszta konstansok és számítások, prisma-import NÉLKÜL,
// hogy kliens-komponensek is importálhassák. A prisma-függő napló a lib/assets-ben.

export const PLACEMENT_STATUSES = [
  'draft',              // előkészítve, fizikailag még nem adtuk át — NEM számít készletbe
  'out',                // ember megerősítette: átadva, kint van
  'partially_returned', // egy része visszajött, más része kint
  'returned',           // minden visszajött hiánytalanul
  'closed_with_loss',   // lezárva, de tétel hiányzik (érték kiesett)
  'discarded',          // piszkozat elvetve
] as const
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number]

export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  draft: 'Piszkozat',
  out: 'Kint van',
  partially_returned: 'Részben visszavéve',
  returned: 'Visszavéve',
  closed_with_loss: 'Hiánnyal lezárva',
  discarded: 'Elvetve',
}

export const CONTRACT_STATUSES = ['none', 'generated', 'sent', 'signed'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const ASSET_CATEGORIES = ['stand', 'carousel', 'penholder', 'other'] as const
export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  stand: 'Állvány',
  carousel: 'Karusszel',
  penholder: 'Tolltartó',
  other: 'Egyéb',
}

// Az „kint van" készletbe azok az átadások számítanak, ahol fizikailag van még
// eszköz a partnernél. A piszkozat és a lezárt állapotok NEM.
const OUT_STATUSES: PlacementStatus[] = ['out', 'partially_returned']
export function isOutStatus(status: string): boolean {
  return OUT_STATUSES.includes(status as PlacementStatus)
}

// A szerződés zárolva van, ha kiment / aláírták — a tétel-összetétel ekkor már
// nem módosítható (a napló különben csak látszat-bizonyíték lenne).
export function isContractLocked(contractStatus: string): boolean {
  return contractStatus === 'sent' || contractStatus === 'signed'
}

// ─── Számítások ──────────────────────────────────────────────────────────────

export interface ItemLike {
  quantity: number
  returnedQty: number
  lostQty: number
  unitValueSnapshot: number
}

// Az átadás státusza a TÉTELEKBŐL számítódik minden visszavételi művelet után —
// kézzel nem állítjuk. Csak megerősített (kint lévő / visszavételezés alatti)
// átadásra hívjuk; a draft/discarded állapotot ez nem érinti.
export function deriveStatus(items: ItemLike[]): PlacementStatus {
  let remaining = 0     // ami még fizikailag kint van
  let settled = 0       // ami már vissza VAGY hiányként lezárult
  let lost = 0          // ami hiányzik
  for (const it of items) {
    remaining += it.quantity - it.returnedQty - it.lostQty
    settled += it.returnedQty + it.lostQty
    lost += it.lostQty
  }
  if (remaining > 0) {
    return settled > 0 ? 'partially_returned' : 'out'
  }
  return lost > 0 ? 'closed_with_loss' : 'returned'
}

export interface PlacementValues {
  totalValue: number       // az eredeti átadási érték (minden tétel)
  outstandingValue: number // ami még kint van a partnernél
  lostValue: number        // a pénzben kifejezett veszteség
}

export function computeValues(items: ItemLike[]): PlacementValues {
  let totalValue = 0
  let outstandingValue = 0
  let lostValue = 0
  for (const it of items) {
    const outstanding = it.quantity - it.returnedQty - it.lostQty
    totalValue += it.quantity * it.unitValueSnapshot
    outstandingValue += Math.max(0, outstanding) * it.unitValueSnapshot
    lostValue += it.lostQty * it.unitValueSnapshot
  }
  return {
    totalValue: round2(totalValue),
    outstandingValue: round2(outstandingValue),
    lostValue: round2(lostValue),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
