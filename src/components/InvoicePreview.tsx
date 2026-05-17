'use client'

import { Printer } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface Invoice {
  id?: string
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  status: string
  stornoOf: string | null
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  billingName?: string | null
  billingAddress?: string | null
  billingZip?: string | null
  billingCity?: string | null
  billingCountry?: string | null
  contact: { firstName: string; lastName: string } | null
  company: {
    name: string
    address: string | null
    zip: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: InvoiceItem[]
}

function fmtDE(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd.MM.yyyy')
}

const ITEMS_PER_PAGE = 5

export default function InvoicePreview({ invoice, printMode }: { invoice: Invoice; printMode?: boolean }) {
  const paymentDays = differenceInDays(new Date(invoice.dueDate), new Date(invoice.date))
  const productItems = invoice.items.filter(i => !i.isDiscount)
  const discountItems = invoice.items.filter(i => i.isDiscount)
  const hasDiscounts = discountItems.length > 0
  const productSubtotal = productItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = discountItems.reduce((s, i) => s + Math.abs(i.unitPrice), 0)

  // 5 tétel/lap — üres tömb esetén egy üres oldalt biztosít
  const chunks: typeof productItems[] = []
  for (let i = 0; i < productItems.length; i += ITEMS_PER_PAGE) {
    chunks.push(productItems.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const S = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px' }

  return (
    <div>
      {!printMode && (
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.open(`/invoices/${invoice.id}/print`, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
          >
            <Printer size={16} />
            Nyomtatás / PDF mentés
          </button>
        </div>
      )}

      <div
        id="invoice-print"
        className="bg-white border border-gray-200 rounded-lg"
        style={{ ...S, padding: '32px 40px', maxWidth: '800px', margin: '0 auto' }}
      >
        {/* ── FEJLÉC ── */}
        <div id="invoice-header">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Memini LOGO SVG.svg" alt="Memini Design"
                style={{ height: '60px', width: 'auto', display: 'block', marginLeft: 'auto' }}
              />
              <div style={{ marginTop: '6px', lineHeight: 1.5 }}>
                <p style={{ fontWeight: 700, fontSize: '12px' }}>Laszlo Arpad Dohanyos e.U.</p>
                <p style={{ fontSize: '11px' }}>Laszlo Arpad Dohanyos</p>
                <p style={{ fontSize: '11px' }}>Römerstraße 32, 89077 Ulm</p>
                <p style={{ fontSize: '11px' }}>Deutschland</p>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#555', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
            Laszlo Arpad Dohanyos e.U.&nbsp;&nbsp;│&nbsp;&nbsp;Römerstraße 32&nbsp;&nbsp;│&nbsp;&nbsp;89077 Ulm
          </div>
        </div>

        {/* ── TARTALOM ── */}
        <div id="invoice-content">
          {/* Empfänger bal + Rechnungsdetails jobb */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', marginBottom: '28px' }}>
            <div style={{ lineHeight: 1.6, fontSize: '12px' }}>
              {(() => {
                const name = invoice.billingName || invoice.company?.name || null
                const address = invoice.billingAddress || invoice.company?.address || null
                const zip = invoice.billingZip || invoice.company?.zip || null
                const city = invoice.billingCity || invoice.company?.city || null
                const phone = invoice.company?.phone || null
                const email = invoice.company?.email || null
                if (!name && !invoice.contact) return null
                return (
                  <>
                    {name && name.split('\n').map((line, i) => (
                      <p key={i} style={{ fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? '13px' : '12px' }}>{line}</p>
                    ))}
                    {invoice.contact && (
                      <p>{invoice.contact.firstName} {invoice.contact.lastName}</p>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      {address && <p>{address}</p>}
                      {(zip || city) && <p>{[zip, city].filter(Boolean).join(' ')}</p>}
                      {phone && <p>Tel.: {phone}</p>}
                      {email && <p>E-Mail: {email}</p>}
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={{ fontSize: '12px', fontStyle: 'italic', textAlign: 'right', lineHeight: 1.8 }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Rechnungs-Nr.:</td>
                    <td style={{ textAlign: 'right', fontWeight: 400 }}>{invoice.number}</td>
                  </tr>
                  {invoice.company?.customerNumber && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Kunden-Nr.:</td>
                      <td style={{ textAlign: 'right' }}>{invoice.company.customerNumber}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Rechnungsdatum:</td>
                    <td style={{ textAlign: 'right' }}>{fmtDate(invoice.date)}</td>
                  </tr>
                  {invoice.deliveryInfo && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Lieferdatum:</td>
                      <td style={{ textAlign: 'right' }}>{invoice.deliveryInfo}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Zahlungsfrist:</td>
                    <td style={{ textAlign: 'right' }}>{paymentDays} Tage</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cím */}
          <h1 style={{ fontSize: '36px', fontWeight: 400, marginBottom: '10px', marginTop: '8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {invoice.stornoOf ? 'Stornorechnung' : 'Rechnung'}
          </h1>

          {invoice.stornoOf && (
            <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', color: '#c00', lineHeight: 1.5 }}>
              Diese Stornorechnung bezieht sich auf Rechnung Nr. {invoice.stornoOf} und hebt diese vollständig auf.
            </p>
          )}

          {!invoice.stornoOf && (
            <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>
              Ich danke Ihnen herzlich für Ihr Vertrauen in unsere Produkte und werde Ihnen nun, gemäß unserer
              Vereinbarung, die folgenden Lieferungen in Rechnung stellen:
            </p>
          )}

          {/* Tételek — max 5/oldal, minden chunk új lapon kezdődik */}
          {chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1
            return (
              <div key={chunkIndex} className={chunkIndex > 0 ? 'invoice-page-break' : ''}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: isLast ? '24px' : '0' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Produktbezeichnung</th>
                      <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '80px' }}>Menge<br />(Stück)</th>
                      <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '110px' }}>Preis<br />(€&nbsp;/&nbsp;Stück)</th>
                      <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '110px' }}>Gesamtpreis<br />(€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((item) => {
                      const [line1, line2, line3] = item.description.split('\n')
                      return (
                        <tr key={item.id}>
                          <td style={{ border: '1px solid #333', padding: '8px 10px' }}>
                            <p style={{ fontWeight: 700, fontStyle: 'italic', margin: 0 }}>{line1}</p>
                            {line2 && <p style={{ fontWeight: 700, fontStyle: 'italic', margin: '1px 0 0 0', fontSize: '11px' }}>{line2}</p>}
                            {line3 && <p style={{ fontStyle: 'italic', margin: '1px 0 0 0', fontSize: '10px' }}>{line3}</p>}
                          </td>
                          <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'right' }}>{fmtDE(item.unitPrice)}</td>
                          <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'right' }}>{fmtDE(item.quantity * item.unitPrice)}</td>
                        </tr>
                      )
                    })}

                    {/* Összesítő sorok csak az utolsó chunkon */}
                    {isLast && (
                      <>
                        {hasDiscounts && (
                          <tr>
                            <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Summe Netto</td>
                            <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(productSubtotal)}</td>
                          </tr>
                        )}
                        {discountItems.map((item) => (
                          <tr key={item.id}>
                            <td colSpan={2} style={{ border: '1px solid #333', padding: '8px 10px', fontStyle: 'italic', fontWeight: 700 }}>{item.description}</td>
                            <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'center' }}>1</td>
                            <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'right' }}>{fmtDE(Math.abs(item.unitPrice))}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Summe Netto</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(hasDiscounts ? productSubtotal - discountTotal : invoice.subtotal)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontStyle: 'italic' }}>zzgl. MwSt. 19%</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(invoice.vatAmount)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Gesamtsumme</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtDE(invoice.total)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })}

          {invoice.notes && (
            <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
              <p style={{ textDecoration: 'underline', marginBottom: '4px' }}>Hinweis:</p>
              <p>{invoice.notes}</p>
            </div>
          )}

          <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
            Die Zahlung erfolgt innerhalb von {paymentDays} Tagen ab Rechnungseingang ohne Abzüge auf das unten
            angegebene Bankkonto. Ich danke Ihnen für Ihren Auftrag und freue mich auf die weitere Zusammenarbeit.
          </p>

          <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.8 }}>
            <p>Mit freundlichen Grüßen</p>
            <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos</p>
          </div>
        </div>

        {/* ── LÁBLÉC ── */}
        <div id="invoice-footer">
          {/* 3 oszlop */}
          <div style={{ borderTop: '1px solid #333', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '10px', lineHeight: 1.6 }}>
            <div>
              <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos e.U.</p>
              <p>Römerstraße 32</p>
              <p>89077 Ulm, Deutschland</p>
            </div>
            <div>
              <p style={{ fontWeight: 700 }}>Kontakt Informationen:</p>
              <p>Tel.: +49 176 36373422</p>
              <p>E-Mail: verwaltung@meminidesign.de</p>
            </div>
            <div>
              <p style={{ fontWeight: 700 }}>Bank Verbindung</p>
              <p>Geldinstitut: Sparkasse Ulm</p>
              <p>IBAN: DE57 6305 0000 0021 3127 53</p>
              <p>SWIFT/BIC: SOLADES1ULM</p>
              <p>USt-IdNr.: DE 334750913</p>
            </div>
          </div>
          {/* Csík + aláírás sor */}
          <div style={{ borderTop: '1px solid #aaa', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
            <div style={{ width: '38%' }}>
              <p style={{ marginBottom: '12px' }}>Ort, Datum:</p>
              <div style={{ borderBottom: '1px solid #555', width: '100%' }} />
            </div>
            <div style={{ width: '38%' }}>
              <p style={{ marginBottom: '12px' }}>Unterschrift:</p>
              <div style={{ borderBottom: '1px solid #555', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          /*
           * Fejléc magassága: ~48mm (8mm padding + logo + cím + visszacím sáv)
           * Lábléc magassága: ~28mm (tartalom + 6mm padding)
           * @page margók: bőven felülmúlják a tényleges magasságot
           * #invoice-content padding-bottom: extra puffer, garantáltan nem csúszik a lábléc alá
           */
          @page { size: A4; margin: 56mm 18mm 52mm 18mm; }

          /* App shell feloldása */
          html, body { height: auto !important; overflow: visible !important; background: white !important; }
          .h-screen { height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-auto { overflow: visible !important; height: auto !important; }
          .pb-16 { padding-bottom: 0 !important; }
          .bg-slate-900 { display: none !important; }

          /* Fő keret */
          #invoice-print {
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Fejléc: fix minden oldalon a tetején */
          #invoice-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 8mm 18mm 4mm !important;
            background: white !important;
          }

          /* Lábléc: fix minden oldalon az alján */
          #invoice-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 0 18mm 8mm !important;
            background: white !important;
          }

          /* Tartalom: extra puffer alul hogy ne csússzon a lábléc alá */
          #invoice-content {
            padding-bottom: 12mm !important;
          }

          /* Lapváltás a 2. chunktól */
          .invoice-page-break {
            page-break-before: always !important;
            break-before: page !important;
            padding-top: 8px;
          }

          /* Sorok ne törjenek ketté */
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
