import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, ImageRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, Header, Footer, convertInchesToTwip, VerticalAlign,
} from 'docx'

function fmtDE(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(d: string | Date) {
  const date = new Date(d)
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}

const FONT = 'Arial'
const N = 20    // 10pt in half-points
const SM = 18   // 9pt
const XS = 16   // 8pt
const H1 = 52   // 26pt

const NONE = BorderStyle.NONE

const noBorders = {
  top:    { style: NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: NONE, size: 0, color: 'FFFFFF' },
  left:   { style: NONE, size: 0, color: 'FFFFFF' },
  right:  { style: NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: NONE, size: 0, color: 'FFFFFF' },
  insideVertical:   { style: NONE, size: 0, color: 'FFFFFF' },
}

const solidBorder = { style: BorderStyle.SINGLE, size: 4, color: '333333' }

const cellBorders = {
  top: solidBorder, bottom: solidBorder,
  left: solidBorder, right: solidBorder,
  insideHorizontal: { style: NONE, size: 0, color: 'FFFFFF' },
  insideVertical:   { style: NONE, size: 0, color: 'FFFFFF' },
}

const topOnlyBorder = {
  ...noBorders,
  top: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
}

function r(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? N, bold: opts.bold, italics: opts.italic, color: opts.color ?? '111111' })
}

function p(children: TextRun[], align?: typeof AlignmentType[keyof typeof AlignmentType], afterPt = 0) {
  return new Paragraph({ children, alignment: align, spacing: { after: afterPt } })
}

function td(text: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT, opts: { bold?: boolean; italic?: boolean; size?: number; colSpan?: number } = {}) {
  return new TableCell({
    borders: cellBorders,
    columnSpan: opts.colSpan,
    children: [p([r(text, { size: SM, bold: opts.bold, italic: opts.italic })], align)],
  })
}

function th(text: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    borders: cellBorders,
    shading: { type: ShadingType.SOLID, color: 'EEEEEE', fill: 'EEEEEE' },
    children: [p([r(text, { size: SM, bold: true })], align)],
  })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { contact: true, company: true, items: { orderBy: { id: 'asc' } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const productItems  = invoice.items.filter(i => !i.isDiscount)
  const discountItems = invoice.items.filter(i => i.isDiscount)
  const hasDiscounts  = discountItems.length > 0
  const productSubtotal = productItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal   = discountItems.reduce((s, i) => s + Math.abs(i.unitPrice), 0)
  const paymentDays = Math.round((new Date(invoice.dueDate).getTime() - new Date(invoice.date).getTime()) / 86400000)

  const recipientName    = invoice.billingName    || invoice.company?.name    || ''
  const recipientAddress = invoice.billingAddress || invoice.company?.address || ''
  const recipientZip     = invoice.billingZip     || invoice.company?.zip     || ''
  const recipientCity    = invoice.billingCity    || invoice.company?.city    || ''

  const logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', 'Memini LOGO PNG@4x.png'))

  // ── FEJLÉC ──
  const headerContent = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: noBorders, children: [p([])] }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 60 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 110, height: 37 }, type: 'png' })],
              }),
              p([r('Laszlo Arpad Dohanyos e.U.', { bold: true })], AlignmentType.RIGHT, 20),
              p([r('Laszlo Arpad Dohanyos', { size: SM })], AlignmentType.RIGHT, 20),
              p([r('Römerstraße 32, 89077 Ulm', { size: SM })], AlignmentType.RIGHT, 20),
              p([r('Deutschland', { size: SM })], AlignmentType.RIGHT),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' } },
            children: [new Paragraph({ spacing: { after: 60 }, children: [r('Laszlo Arpad Dohanyos e.U.  │  Römerstraße 32  │  89077 Ulm', { size: XS, color: '555555' })] })],
          }),
        ],
      }),
    ],
  })

  // ── LÁBLÉC ──
  const footerContent = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: topOnlyBorder,
            children: [
              p([r('Laszlo Arpad Dohanyos e.U.', { bold: true, size: XS })], undefined, 20),
              p([r('Römerstraße 32', { size: XS })], undefined, 20),
              p([r('89077 Ulm, Deutschland', { size: XS })]),
            ],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            borders: topOnlyBorder,
            children: [
              p([r('Kontakt Informationen:', { bold: true, size: XS })], undefined, 20),
              p([r('Tel.: +49 176 36373422', { size: XS })], undefined, 20),
              p([r('E-Mail: verwaltung@meminidesign.de', { size: XS })]),
            ],
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: topOnlyBorder,
            children: [
              p([r('Bank Verbindung', { bold: true, size: XS })], undefined, 20),
              p([r('Geldinstitut: Sparkasse Ulm', { size: XS })], undefined, 20),
              p([r('IBAN: DE57 6305 0000 0021 3127 53', { size: XS })], undefined, 20),
              p([r('SWIFT/BIC: SOLADES1ULM', { size: XS })], undefined, 20),
              p([r('USt-IdNr.: DE 334750913', { size: XS })]),
            ],
          }),
        ],
      }),
    ],
  })

  // ── EMPFÄNGER + RECHNUNGSDETAILS ──
  const detailRows: [string, string][] = [
    ['Rechnungs-Nr.:', invoice.number],
    ...(invoice.company?.customerNumber ? [['Kunden-Nr.:', invoice.company.customerNumber] as [string, string]] : []),
    ['Rechnungsdatum:', fmtDate(invoice.date)],
    ...(invoice.deliveryInfo ? [['Lieferdatum:', invoice.deliveryInfo] as [string, string]] : []),
    ['Zahlungsfrist:', `${paymentDays} Tage`],
  ]

  const recipientLines = [
    recipientName,
    ...(invoice.contact ? [`${invoice.contact.firstName} ${invoice.contact.lastName}`] : []),
    recipientAddress,
    [recipientZip, recipientCity].filter(Boolean).join(' '),
    invoice.company?.phone ? `Tel.: ${invoice.company.phone}` : '',
    invoice.company?.email ? `E-Mail: ${invoice.company.email}` : '',
  ].filter(Boolean)

  const addressBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: recipientLines.map((line, i) =>
              p([r(line, { bold: i === 0, size: i === 0 ? N + 2 : N })], undefined, 20)
            ),
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: detailRows.map(([label, value]) =>
              p([r(label + '  ', { italic: true, size: SM }), r(value, { italic: true, size: SM })], AlignmentType.RIGHT, 20)
            ),
          }),
        ],
      }),
    ],
  })

  // ── TÉTELEK TÁBLÁZAT ──
  const itemRows = productItems.map(item => {
    const [l1, l2, l3] = item.description.split('\n')
    return new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          children: [
            p([r(l1, { bold: true, italic: true, size: SM })], undefined, l2 ? 20 : 0),
            ...(l2 ? [p([r(l2, { bold: true, italic: true, size: SM })], undefined, l3 ? 20 : 0)] : []),
            ...(l3 ? [p([r(l3, { italic: true, size: XS })])] : []),
          ],
        }),
        td(String(item.quantity), AlignmentType.CENTER),
        td(fmtDE(item.unitPrice), AlignmentType.RIGHT),
        td(fmtDE(item.quantity * item.unitPrice), AlignmentType.RIGHT),
      ],
    })
  })

  const summaryRows: TableRow[] = []
  if (hasDiscounts) {
    summaryRows.push(new TableRow({ children: [td('Summe Netto', AlignmentType.RIGHT, { bold: true, colSpan: 3 }), td(fmtDE(productSubtotal), AlignmentType.RIGHT, { bold: true })] }))
    discountItems.forEach(item => summaryRows.push(
      new TableRow({ children: [td(item.description, AlignmentType.LEFT, { bold: true, italic: true, colSpan: 2 }), td('1', AlignmentType.CENTER), td(fmtDE(Math.abs(item.unitPrice)), AlignmentType.RIGHT)] })
    ))
  }
  summaryRows.push(
    new TableRow({ children: [td('Summe Netto', AlignmentType.RIGHT, { bold: true, colSpan: 3 }), td(fmtDE(hasDiscounts ? productSubtotal - discountTotal : invoice.subtotal), AlignmentType.RIGHT, { bold: true })] }),
    new TableRow({ children: [td('zzgl. MwSt. 19%', AlignmentType.RIGHT, { italic: true, colSpan: 3 }), td(fmtDE(invoice.vatAmount), AlignmentType.RIGHT)] }),
    new TableRow({ children: [td('Gesamtsumme', AlignmentType.RIGHT, { bold: true, colSpan: 3 }), td(fmtDE(invoice.total), AlignmentType.RIGHT, { bold: true })] }),
  )

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [convertInchesToTwip(3.8), convertInchesToTwip(0.8), convertInchesToTwip(1.1), convertInchesToTwip(1.1)],
    rows: [
      new TableRow({ tableHeader: true, children: [th('Produktbezeichnung'), th('Menge (Stück)', AlignmentType.CENTER), th('Preis (€ / Stück)', AlignmentType.CENTER), th('Gesamtpreis (€)', AlignmentType.CENTER)] }),
      ...itemRows,
      ...summaryRows,
    ],
  })

  // ── DOKUMENTUM ──
  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1800, bottom: 1440, left: 1080, right: 1080 } },
      },
      headers: { default: new Header({ children: [headerContent] }) },
      footers: { default: new Footer({ children: [footerContent] }) },
      children: [
        addressBlock,
        new Paragraph({ spacing: { before: 240, after: 120 }, children: [r(invoice.stornoOf ? 'Stornorechnung' : 'Rechnung', { size: H1 })] }),
        ...(invoice.stornoOf
          ? [p([r(`Diese Stornorechnung bezieht sich auf Rechnung Nr. ${invoice.stornoOf} und hebt diese vollständig auf.`, { italic: true, color: 'CC0000' })], undefined, 120)]
          : [p([r('Ich danke Ihnen herzlich für Ihr Vertrauen in unsere Produkte und werde Ihnen nun, gemäß unserer Vereinbarung, die folgenden Lieferungen in Rechnung stellen:', { italic: true })], undefined, 160)]
        ),
        itemsTable,
        ...(invoice.notes ? [
          p([r('Hinweis:', { size: SM })], undefined, 40),
          p([r(invoice.notes, { italic: true, size: SM })], undefined, 160),
        ] : []),
        p([r(`Die Zahlung erfolgt innerhalb von ${paymentDays} Tagen ab Rechnungseingang ohne Abzüge auf das unten angegebene Bankkonto. Ich danke Ihnen für Ihren Auftrag und freue mich auf die weitere Zusammenarbeit.`, { italic: true })], undefined, 160),
        p([r('Mit freundlichen Grüßen', { italic: true })], undefined, 40),
        p([r('Laszlo Arpad Dohanyos', { bold: true, italic: true })]),
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Rechnung-${invoice.number.replace('/', '-')}.docx"`,
    },
  })
}
