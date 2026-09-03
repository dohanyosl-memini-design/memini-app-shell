import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
} from 'docx'
import { currentUser } from '@/lib/apiAuth'
import { prepareContract, contractEuro, type ContractRow } from '@/lib/assetContract'

export const dynamic = 'force-dynamic'

const FONT = 'Arial'
const N = 20   // ~10pt törzs
const H1 = 40  // cím

function r(text: string, opts: { bold?: boolean } = {}) {
  return new TextRun({ text, font: FONT, size: N, bold: opts.bold ?? false })
}
// A § kezdetű sorok félkövérek.
function textToParagraphs(text: string): Paragraph[] {
  return text.split('\n').map(line =>
    new Paragraph({ spacing: { after: 60 }, children: [r(line, { bold: line.trimStart().startsWith('§') })] }))
}

const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: '999999' }
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }
function cell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: cellBorders,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, font: FONT, size: N, bold: opts.bold ?? false })] })],
  })
}

function itemsTable(rows: ContractRow[]) {
  const trs: TableRow[] = [
    new TableRow({ tableHeader: true, children: [
      cell('Bezeichnung', { bold: true, width: 64 }),
      cell('Menge', { bold: true, align: AlignmentType.CENTER, width: 16 }),
      cell('Wert', { bold: true, align: AlignmentType.RIGHT, width: 20 }),
    ] }),
    ...rows.map(row => new TableRow({ children: [
      cell(row.isComponent ? `     – ${row.name}` : row.name),
      cell(String(row.qty), { align: AlignmentType.CENTER }),
      cell(contractEuro(row.value), { align: AlignmentType.RIGHT }),
    ] })),
  ]
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: trs })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser()
  const data = await prepareContract(params.id, user?.email ?? 'human')
  if (!data) {
    return NextResponse.json({ error: 'Az átadás nem található, vagy nincs tétele.' }, { status: 400 })
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 } } },
      children: [
        new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.titleDe, font: FONT, size: H1, bold: true })] }),
        ...textToParagraphs(data.pre),
        itemsTable(data.rows),
        ...textToParagraphs(data.post),
        ...(data.addenda.length ? [
          new Paragraph({ spacing: { before: 240, after: 80 }, children: [r('Ergänzungen', { bold: true })] }),
          ...data.addenda.flatMap(a => [
            new Paragraph({ spacing: { after: 20 }, children: [r(a.name, { bold: true })] }),
            ...textToParagraphs(a.text),
          ]),
        ] : []),
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)
  const safeCompany = data.companyName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Partner'
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${data.contractNumber}_${safeCompany}.docx"`,
    },
  })
}
