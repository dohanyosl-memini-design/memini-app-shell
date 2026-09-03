import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
} from 'docx'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/apiAuth'
import { computeValues, logAssetEvent } from '@/lib/assets'
import { DEFAULT_CONTRACT_TITLE, DEFAULT_CONTRACT_BODY } from '@/lib/assetContractDefault'

export const dynamic = 'force-dynamic'

const FONT = 'Arial'
const N = 20   // ~10pt törzs
const H1 = 40  // cím
const NONE = BorderStyle.NONE

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(d: Date | null) {
  const date = d ? new Date(d) : new Date()
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}
function r(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? N, bold: opts.bold ?? false, italics: opts.italic ?? false })
}
// Egy szövegtömb sorait bekezdésekké alakítja; a § kezdetű sorok félkövérek.
function textToParagraphs(text: string): Paragraph[] {
  return text.split('\n').map(line => {
    const bold = line.trimStart().startsWith('§')
    return new Paragraph({ spacing: { after: 60 }, children: [r(line, { bold })] })
  })
}

const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: '999999' }
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }

function cell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: cellBorders,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: opts.align, children: [r(text, { bold: opts.bold })] })],
  })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  const actor = user?.email ?? 'human'

  const placement = await prisma.assetPlacement.findUnique({
    where: { id: params.id },
    include: {
      company: true,
      contact: { select: { firstName: true, lastName: true, salutation: true } },
      issuedBy: { select: { name: true } },
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  if (!placement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (placement.items.length === 0) {
    return NextResponse.json({ error: 'Az átadáshoz nincs tétel, nincs mit szerződésbe foglalni.' }, { status: 400 })
  }

  const tpl = (await prisma.assetContractTemplate.findUnique({ where: { id: 'default' } }))
    ?? { titleDe: DEFAULT_CONTRACT_TITLE, bodyDe: DEFAULT_CONTRACT_BODY }

  const c = placement.company
  const values = computeValues(placement.items)

  // Szerződés-sorszám: első generáláskor kiosztjuk (LV-ÉV-NNN), utána megtartjuk.
  let contractNumber = placement.contractNumber
  if (!contractNumber) {
    const year = new Date().getFullYear()
    const count = await prisma.assetPlacement.count({ where: { contractNumber: { startsWith: `LV-${year}-` } } })
    contractNumber = `LV-${year}-${String(count + 1).padStart(3, '0')}`
  }

  const ansprech = placement.contact
    ? [placement.contact.salutation, placement.contact.firstName, placement.contact.lastName].filter(Boolean).join(' ')
    : ''
  const uebergabe = fmtDate(placement.issuedAt)
  const uebergeben = placement.issuedBy?.name ?? ''

  // Skalár tokenek behelyettesítése (a {{Geräteliste}} külön kerül be, táblaként).
  const scalars: Record<string, string> = {
    '{{Firmenname}}': c.name ?? '',
    '{{Adresse}}': c.address ?? '',
    '{{PLZ}}': c.zip ?? '',
    '{{Ort}}': c.city ?? '',
    '{{Land}}': c.country ?? '',
    '{{Ansprechpartner}}': ansprech,
    '{{USt_IdNr}}': c.vatId ?? '',
    '{{Gesamtwert}}': euro(values.totalValue),
    '{{Übergabedatum}}': uebergabe,
    '{{Übergeben_durch}}': uebergeben,
    '{{Vertragsnummer}}': contractNumber,
  }
  let body = tpl.bodyDe
  for (const [k, v] of Object.entries(scalars)) body = body.split(k).join(v)

  // A {{Geräteliste}} köré bontjuk a szöveget: elé/mögé bekezdések, közé tábla.
  const [pre, post] = body.split('{{Geräteliste}}')

  const assets = placement.items.filter(i => i.kind === 'asset')
  const childrenOf = (id: string) => placement.items.filter(i => i.parentItemId === id)
  const rows: TableRow[] = [
    new TableRow({ tableHeader: true, children: [
      cell('Bezeichnung', { bold: true, width: 64 }),
      cell('Menge', { bold: true, align: AlignmentType.CENTER, width: 16 }),
      cell('Wert', { bold: true, align: AlignmentType.RIGHT, width: 20 }),
    ] }),
  ]
  for (const a of assets) {
    rows.push(new TableRow({ children: [
      cell(a.nameSnapshot),
      cell(String(a.quantity), { align: AlignmentType.CENTER }),
      cell(euro(a.quantity * a.unitValueSnapshot), { align: AlignmentType.RIGHT }),
    ] }))
    for (const ch of childrenOf(a.id)) {
      rows.push(new TableRow({ children: [
        cell(`     – ${ch.nameSnapshot}`),
        cell(String(ch.quantity), { align: AlignmentType.CENTER }),
        cell(euro(ch.quantity * ch.unitValueSnapshot), { align: AlignmentType.RIGHT }),
      ] }))
    }
  }
  const geraeteTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })

  // Kellék-kiegészítések: az érintett kellékek contractAddendumDe szövegei.
  const typeIds = Array.from(new Set(assets.map(a => a.assetTypeId).filter(Boolean))) as string[]
  const types = typeIds.length
    ? await prisma.assetType.findMany({ where: { id: { in: typeIds } }, select: { nameDE: true, name: true, contractAddendumDe: true } })
    : []
  const addenda = types.filter(t => t.contractAddendumDe && t.contractAddendumDe.trim())

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 } } },
      children: [
        new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER, children: [r(tpl.titleDe, { bold: true, size: H1 })] }),
        ...textToParagraphs(pre ?? ''),
        geraeteTable,
        ...textToParagraphs(post ?? ''),
        ...(addenda.length ? [
          new Paragraph({ spacing: { before: 240, after: 80 }, children: [r('Ergänzungen', { bold: true })] }),
          ...addenda.flatMap(t => [
            new Paragraph({ spacing: { after: 20 }, children: [r(t.nameDE || t.name, { bold: true })] }),
            ...textToParagraphs(t.contractAddendumDe as string),
          ]),
        ] : []),
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)

  // Állapot rögzítése: sorszám + „generated" + pillanatkép (ha még nincs zárolva).
  const locked = placement.contractStatus === 'sent' || placement.contractStatus === 'signed'
  if (!locked) {
    await prisma.assetPlacement.update({
      where: { id: placement.id },
      data: {
        contractNumber,
        contractStatus: placement.contractStatus === 'none' ? 'generated' : placement.contractStatus,
        contractSnapshot: {
          number: contractNumber,
          totalValue: values.totalValue,
          items: placement.items.map(i => ({ name: i.nameSnapshot, qty: i.quantity, value: i.unitValueSnapshot, kind: i.kind })),
          generatedAt: new Date().toISOString(),
        } as never,
      },
    })
    await logAssetEvent(placement.id, actor, 'contract_generated', undefined, null, { contractNumber })
  } else if (placement.contractNumber !== contractNumber) {
    await prisma.assetPlacement.update({ where: { id: placement.id }, data: { contractNumber } })
  }

  const safeCompany = (c.name ?? 'Partner').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Partner'
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${contractNumber}_${safeCompany}.docx"`,
    },
  })
}
