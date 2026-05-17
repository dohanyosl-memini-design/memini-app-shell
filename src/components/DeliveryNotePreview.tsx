'use client'

import { Printer } from 'lucide-react'
import { format } from 'date-fns'

interface DeliveryNoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface DeliveryNote {
  number: string
  date: string
  deliveryInfo: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  notes: string | null
  billingName: string | null
  billingAddress: string | null
  billingZip: string | null
  billingCity: string | null
  billingCountry: string | null
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
  items: DeliveryNoteItem[]
}

function fmtDE(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd.MM.yyyy')
}

const ITEMS_PER_PAGE = 5

export default function DeliveryNotePreview({ deliveryNote }: { deliveryNote: DeliveryNote }) {
  const productItems = deliveryNote.items.filter(i => !i.isDiscount)
  const discountItems = deliveryNote.items.filter(i => i.isDiscount)
  const hasDiscounts = discountItems.length > 0
  const productSubtotal = productItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = discountItems.reduce((s, i) => s + Math.abs(i.unitPrice), 0)

  const chunks: typeof productItems[] = []
  for (let i = 0; i < productItems.length; i += ITEMS_PER_PAGE) {
    chunks.push(productItems.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const recipientName = deliveryNote.billingName || deliveryNote.company?.name || null
  const recipientAddress = deliveryNote.billingAddress || deliveryNote.company?.address || null
  const recipientZip = deliveryNote.billingZip || deliveryNote.company?.zip || null
  const recipientCity = deliveryNote.billingCity || deliveryNote.company?.city || null

  return (
    <div>
      <div className="flex justify-end mb-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
        >
          <Printer size={16} />
          Nyomtatás / PDF mentés
        </button>
      </div>

      <div
        id="dn-print"
        className="bg-white border border-gray-200 rounded-lg"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', padding: '32px 40px', maxWidth: '800px', margin: '0 auto' }}
      >
        {/* ── FEJLÉC (minden oldalon ismétlődik nyomtatásban) ── */}
        <div id="dn-header">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Memini LOGO SVG.svg" alt="Memini Design"
                style={{ height: '60px', width: 'auto', display: 'block', marginLeft: 'auto' }}
              />
              <div style={{ marginTop: '8px', lineHeight: 1.5 }}>
                <p style={{ fontWeight: 700, fontSize: '12px' }}>Laszlo Arpad Dohanyos e.U.</p>
                <p style={{ fontSize: '11px' }}>Laszlo Arpad Dohanyos</p>
                <p style={{ fontSize: '11px' }}>Römerstraße 32</p>
                <p style={{ fontSize: '11px' }}>89077 Ulm</p>
              </div>
            </div>
          </div>
          {/* Visszacím sáv — első elválasztó vonal */}
          <div style={{ fontSize: '9px', color: '#444', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
            Laszlo Arpad Dohanyos e.U.&nbsp;&nbsp;│&nbsp;&nbsp;Römerstraße 32&nbsp;&nbsp;│&nbsp;&nbsp;89077 Ulm
          </div>
        </div>

        {/* ── TARTALOM ── */}
        <div id="dn-content">
          {/* Empfänger bal + részletek jobb */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', marginBottom: '28px' }}>
            <div style={{ lineHeight: 1.6, fontSize: '12px' }}>
              {recipientName ? (
                <>
                  {recipientName.split('\n').map((line, i) => (
                    <p key={i} style={{ fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? '13px' : '12px' }}>{line}</p>
                  ))}
                  {deliveryNote.contact && (
                    <p>{deliveryNote.contact.firstName} {deliveryNote.contact.lastName}</p>
                  )}
                  <div style={{ marginTop: '8px' }}>
                    {recipientAddress && <p>{recipientAddress}</p>}
                    {(recipientZip || recipientCity) && (
                      <p>{[recipientZip, recipientCity].filter(Boolean).join(' ')}</p>
                    )}
                    {deliveryNote.company?.phone && <p>Tel.: {deliveryNote.company.phone}</p>}
                    {deliveryNote.company?.email && <p>E-Mail: {deliveryNote.company.email}</p>}
                  </div>
                </>
              ) : deliveryNote.contact ? (
                <p style={{ fontWeight: 700 }}>{deliveryNote.contact.firstName} {deliveryNote.contact.lastName}</p>
              ) : null}
            </div>

            <div style={{ fontSize: '12px', fontStyle: 'italic', textAlign: 'right', lineHeight: 1.8 }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Lieferschein-Nr.:</td>
                    <td style={{ textAlign: 'right', fontWeight: 400 }}>{deliveryNote.number}</td>
                  </tr>
                  {deliveryNote.company?.customerNumber && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Kunden-Nr.:</td>
                      <td style={{ textAlign: 'right' }}>{deliveryNote.company.customerNumber}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Datum:</td>
                    <td style={{ textAlign: 'right' }}>{fmtDate(deliveryNote.date)}</td>
                  </tr>
                  {deliveryNote.deliveryInfo && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Lieferdatum:</td>
                      <td style={{ textAlign: 'right' }}>{deliveryNote.deliveryInfo}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <h1 style={{ fontSize: '36px', fontWeight: 400, marginBottom: '10px', marginTop: '8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Lieferschein
          </h1>

          <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>
            Wir liefern Ihnen gemäß Ihrer Bestellung folgende Waren:
          </p>

          {chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1
            return (
              <div key={chunkIndex} className={chunkIndex > 0 ? 'dn-page-break' : ''}>
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
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(hasDiscounts ? productSubtotal - discountTotal : deliveryNote.subtotal)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontStyle: 'italic' }}>zzgl. MwSt. 19%</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(deliveryNote.vatAmount)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Gesamtsumme</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtDE(deliveryNote.total)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })}

          {deliveryNote.notes && (
            <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
              <p style={{ textDecoration: 'underline', marginBottom: '4px' }}>Hinweis:</p>
              <p>{deliveryNote.notes}</p>
            </div>
          )}

          <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
            Bitte prüfen Sie die Ware bei Erhalt auf Vollständigkeit und Unversehrtheit. Mit freundlichen Grüßen,
          </p>

          <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.8 }}>
            <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos</p>
          </div>
        </div>

        {/* ── LÁBLÉC (minden oldalon ismétlődik nyomtatásban) — második elválasztó vonal ── */}
        <div id="dn-footer" style={{ borderTop: '1px solid #333', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '10px', lineHeight: 1.6 }}>
          <div>
            <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos e.U.</p>
            <p>Römerstraße 32,</p>
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
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 58mm 18mm 40mm 18mm; }

          /* App shell feloldása */
          html, body { height: auto !important; overflow: visible !important; background: white !important; }
          .h-screen { height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-auto { overflow: visible !important; height: auto !important; }
          .pb-16 { padding-bottom: 0 !important; }
          .bg-slate-900 { display: none !important; }

          /* Fő keret */
          #dn-print {
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Fejléc: fix minden oldalon a tetején */
          #dn-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 8mm 18mm 4mm !important;
            background: white !important;
          }

          /* Lábléc: fix minden oldalon az alján */
          #dn-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 0 18mm 8mm !important;
            background: white !important;
          }

          /* Tartalom: extra puffer alul */
          #dn-content {
            padding-bottom: 12mm !important;
          }

          /* Lapváltás a 2. chunktól */
          .dn-page-break {
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
