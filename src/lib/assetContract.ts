// Közös szerződés-összeállító: a DOCX-generálás és a nyomtatható oldal ugyanezt
// használja, így a két kimenet SOHA nem csúszik el. Kitölti a német sablon
// tokenjeit, összerakja a Geräteliste sorait és a kellék-kiegészítéseket, és
// (első alkalommal) kiosztja a sorszámot + „generated"-re állít + pillanatképet
// ment + naplóz. Ezt a modult az MCP (Arthur) NEM hívja — csak a webes route-ok.

import { prisma } from './prisma'
import { computeValues, logAssetEvent } from './assets'
import { DEFAULT_CONTRACT_TITLE, DEFAULT_CONTRACT_BODY } from './assetContractDefault'

export interface ContractRow { name: string; qty: number; value: number; isComponent: boolean }
export interface ContractData {
  titleDe: string
  pre: string        // a Geräteliste ELŐTTI szöveg, tokenek kitöltve
  post: string       // a Geräteliste UTÁNI szöveg
  rows: ContractRow[]
  addenda: { name: string; text: string }[]
  contractNumber: string
  totalValue: number
  companyName: string
}

export function contractEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(d: Date | null) {
  const date = d ? new Date(d) : new Date()
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}

export async function prepareContract(placementId: string, actor: string): Promise<ContractData | null> {
  const placement = await prisma.assetPlacement.findUnique({
    where: { id: placementId },
    include: {
      company: true,
      contact: { select: { firstName: true, lastName: true, salutation: true } },
      issuedBy: { select: { name: true } },
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  if (!placement || placement.items.length === 0) return null

  const tpl = (await prisma.assetContractTemplate.findUnique({ where: { id: 'default' } }))
    ?? { titleDe: DEFAULT_CONTRACT_TITLE, bodyDe: DEFAULT_CONTRACT_BODY }

  const c = placement.company
  const values = computeValues(placement.items)

  // Sorszám: első generáláskor kiosztjuk (LV-ÉV-NNN), utána megtartjuk.
  let contractNumber = placement.contractNumber
  const firstTime = placement.contractStatus === 'none'
  if (!contractNumber) {
    const year = new Date().getFullYear()
    const count = await prisma.assetPlacement.count({ where: { contractNumber: { startsWith: `LV-${year}-` } } })
    contractNumber = `LV-${year}-${String(count + 1).padStart(3, '0')}`
  }

  const ansprech = placement.contact
    ? [placement.contact.salutation, placement.contact.firstName, placement.contact.lastName].filter(Boolean).join(' ')
    : ''
  const scalars: Record<string, string> = {
    '{{Firmenname}}': c.name ?? '',
    '{{Adresse}}': c.address ?? '',
    '{{PLZ}}': c.zip ?? '',
    '{{Ort}}': c.city ?? '',
    '{{Land}}': c.country ?? '',
    '{{Ansprechpartner}}': ansprech,
    '{{USt_IdNr}}': c.vatId ?? '',
    '{{Gesamtwert}}': contractEuro(values.totalValue),
    '{{Übergabedatum}}': fmtDate(placement.issuedAt),
    '{{Übergeben_durch}}': placement.issuedBy?.name ?? '',
    '{{Vertragsnummer}}': contractNumber,
  }
  let body = tpl.bodyDe
  for (const [k, v] of Object.entries(scalars)) body = body.split(k).join(v)
  const [pre, post] = body.split('{{Geräteliste}}')

  const assets = placement.items.filter(i => i.kind === 'asset')
  const childrenOf = (id: string) => placement.items.filter(i => i.parentItemId === id)
  const rows: ContractRow[] = []
  for (const a of assets) {
    rows.push({ name: a.nameSnapshot, qty: a.quantity, value: a.quantity * a.unitValueSnapshot, isComponent: false })
    for (const ch of childrenOf(a.id)) {
      rows.push({ name: ch.nameSnapshot, qty: ch.quantity, value: ch.quantity * ch.unitValueSnapshot, isComponent: true })
    }
  }

  const typeIds = Array.from(new Set(assets.map(a => a.assetTypeId).filter(Boolean))) as string[]
  const types = typeIds.length
    ? await prisma.assetType.findMany({ where: { id: { in: typeIds } }, select: { nameDE: true, name: true, contractAddendumDe: true } })
    : []
  const addenda = types
    .filter(t => t.contractAddendumDe && t.contractAddendumDe.trim())
    .map(t => ({ name: t.nameDE || t.name, text: t.contractAddendumDe as string }))

  // Mellékhatás CSAK első generáláskor (nincs napló-spam ismételt letöltésnél),
  // és sosem zárolt (sent/signed) szerződésnél.
  const locked = placement.contractStatus === 'sent' || placement.contractStatus === 'signed'
  if (firstTime && !locked) {
    await prisma.assetPlacement.update({
      where: { id: placement.id },
      data: {
        contractNumber,
        contractStatus: 'generated',
        contractSnapshot: {
          number: contractNumber,
          totalValue: values.totalValue,
          items: placement.items.map(i => ({ name: i.nameSnapshot, qty: i.quantity, value: i.unitValueSnapshot, kind: i.kind })),
          generatedAt: new Date().toISOString(),
        } as never,
      },
    })
    await logAssetEvent(placement.id, actor, 'contract_generated', undefined, null, { contractNumber })
  } else if (!placement.contractNumber) {
    await prisma.assetPlacement.update({ where: { id: placement.id }, data: { contractNumber } })
  }

  return {
    titleDe: tpl.titleDe,
    pre: pre ?? '',
    post: post ?? '',
    rows,
    addenda,
    contractNumber,
    totalValue: values.totalValue,
    companyName: c.name ?? 'Partner',
  }
}
