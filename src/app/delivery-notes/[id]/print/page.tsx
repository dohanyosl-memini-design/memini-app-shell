'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  id: string
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
    name: string; address: string | null; zip: string | null; city: string | null
    vatId: string | null; phone: string | null; email: string | null; customerNumber: string | null
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

export default function DeliveryNotePrintPage() {
  const params = useParams()
  const [dn, setDn] = useState<DeliveryNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/delivery-notes/${params.id}`)
      .then(r => r.json())
      .then(data => { setDn(data); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (!loading && dn) {
      setTimeout(() => window.print(), 700)
    }
  }, [loading, dn])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial' }}>Betöltés...</div>
  }
  if (!dn) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial' }}>A szállítólevél nem található.</div>
  }

  const productItems = dn.items.filter(i => !i.isDiscount)
  const discountItems = dn.items.filter(i => i.isDiscount)
  const hasDiscounts = discountItems.length > 0
  const productSubtotal = productItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = discountItems.reduce((s, i) => s + Math.abs(i.unitPrice), 0)

  const chunks: typeof productItems[] = []
  for (let i = 0; i < productItems.length; i += ITEMS_PER_PAGE) {
    chunks.push(productItems.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const recipientName = dn.billingName || dn.company?.name || null
  const recipientAddress = dn.billingAddress || dn.company?.address || null
  const recipientZip = dn.billingZip || dn.company?.zip || null
  const recipientCity = dn.billingCity || dn.company?.city || null

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 0; }
        html, body { background: white; }

        .no-print { display: flex; gap: 8px; padding: 12px 18mm; background: #f3f4f6; border-bottom: 1px solid #ddd; }
        .no-print button { padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
        .btn-primary { background: #1f2937; color: white; }
        .btn-secondary { background: #e5e7eb; color: #374151; }
        @media print { .no-print { display: none !important; } }

        table.print-layout {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
        }
        table.print-layout thead { display: table-header-group; }
        table.print-layout tfoot { display: table-footer-group; }
        table.print-layout tbody { display: table-row-group; }

        @media print {
          table.print-layout tfoot {
            display: block !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: white !important;
          }
          .content-cell { padding-bottom: 36mm !important; }
        }

        .header-cell { padding: 8mm 18mm 4mm; border-bottom: 1px solid #888; }
        .footer-cell { padding: 5mm 18mm 6mm; border-top: 1px solid #333; }
        .content-cell { padding: 6mm 18mm 4mm; vertical-align: top; }

        .footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          font-size: 10px;
          line-height: 1.6;
        }
        .footer-grid > div:nth-child(1) { text-align: left; }
        .footer-grid > div:nth-child(2) { text-align: center; }
        .footer-grid > div:nth-child(3) { text-align: right; }

        .page-break {
          page-break-before: always !important;
          break-before: page !important;
          padding-top: 6mm;
        }

        table.items { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        table.items th, table.items td { border: 1px solid #333; padding: 7px 10px; }
        table.items th { font-weight: 700; }
        tr { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print">
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginRight: '8px' }}>{dn.number}</span>
        <button className="btn-primary" onClick={() => window.print()}>🖨️ Nyomtatás / PDF</button>
        <button className="btn-secondary" onClick={() => window.close()}>Bezárás</button>
      </div>

      <table className="print-layout">
        {/* ── FEJLÉC ── */}
        <thead>
          <tr>
            <td className="header-cell">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <div style={{ textAlign: 'right' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Memini LOGO SVG.svg" alt="Memini Design"
                    style={{ height: '60px', width: 'auto', display: 'block', marginLeft: 'auto' }}
                  />
                  <div style={{ marginTop: '6px', lineHeight: 1.5, fontSize: '11px' }}>
                    <p style={{ fontWeight: 700, fontSize: '12px' }}>Laszlo Arpad Dohanyos e.U.</p>
                    <p>Laszlo Arpad Dohanyos</p>
                    <p>Römerstraße 32, 89077 Ulm</p>
                    <p>Deutschland</p>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: '#555' }}>
                Laszlo Arpad Dohanyos e.U.&nbsp;&nbsp;│&nbsp;&nbsp;Römerstraße 32&nbsp;&nbsp;│&nbsp;&nbsp;89077 Ulm
              </div>
            </td>
          </tr>
        </thead>

        {/* ── LÁBLÉC ── */}
        <tfoot>
          <tr>
            <td className="footer-cell">
              <div className="footer-grid">
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
            </td>
          </tr>
        </tfoot>

        {/* ── TARTALOM ── */}
        <tbody>
          <tr>
            <td className="content-cell">

              {/* Empfänger + részletek */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ lineHeight: 1.6, fontSize: '12px' }}>
                  {recipientName ? (
                    <>
                      {recipientName.split('\n').map((line, i) => (
                        <p key={i} style={{ fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? '13px' : '12px' }}>{line}</p>
                      ))}
                      {dn.contact && <p>{dn.contact.firstName} {dn.contact.lastName}</p>}
                      <div style={{ marginTop: '8px' }}>
                        {recipientAddress && <p>{recipientAddress}</p>}
                        {(recipientZip || recipientCity) && <p>{[recipientZip, recipientCity].filter(Boolean).join(' ')}</p>}
                        {dn.company?.phone && <p>Tel.: {dn.company.phone}</p>}
                        {dn.company?.email && <p>E-Mail: {dn.company.email}</p>}
                      </div>
                    </>
                  ) : dn.contact ? (
                    <p style={{ fontWeight: 700 }}>{dn.contact.firstName} {dn.contact.lastName}</p>
                  ) : null}
                </div>
                <div style={{ fontSize: '12px', fontStyle: 'italic', textAlign: 'right', lineHeight: 1.8 }}>
                  <table style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ paddingRight: '20px' }}>Lieferschein-Nr.:</td>
                        <td style={{ textAlign: 'right' }}>{dn.number}</td>
                      </tr>
                      {dn.company?.customerNumber && (
                        <tr>
                          <td style={{ paddingRight: '20px' }}>Kunden-Nr.:</td>
                          <td style={{ textAlign: 'right' }}>{dn.company.customerNumber}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ paddingRight: '20px' }}>Datum:</td>
                        <td style={{ textAlign: 'right' }}>{fmtDate(dn.date)}</td>
                      </tr>
                      {dn.deliveryInfo && (
                        <tr>
                          <td style={{ paddingRight: '20px' }}>Lieferdatum:</td>
                          <td style={{ textAlign: 'right' }}>{dn.deliveryInfo}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <h1 style={{ fontSize: '36px', fontWeight: 400, marginBottom: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Lieferschein
              </h1>
              <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>
                Wir liefern Ihnen gemäß Ihrer Bestellung folgende Waren:
              </p>

              {/* Tételek — 5/oldal */}
              {chunks.map((chunk, chunkIndex) => {
                const isLast = chunkIndex === chunks.length - 1
                return (
                  <div key={chunkIndex} className={chunkIndex > 0 ? 'page-break' : ''}>
                    <table className="items">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Produktbezeichnung</th>
                          <th style={{ textAlign: 'center', width: '80px' }}>Menge<br />(Stück)</th>
                          <th style={{ textAlign: 'center', width: '110px' }}>Preis<br />(€&nbsp;/&nbsp;Stück)</th>
                          <th style={{ textAlign: 'center', width: '110px' }}>Gesamtpreis<br />(€)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map(item => {
                          const [l1, l2, l3] = item.description.split('\n')
                          return (
                            <tr key={item.id}>
                              <td>
                                <p style={{ fontWeight: 700, fontStyle: 'italic', margin: 0 }}>{l1}</p>
                                {l2 && <p style={{ fontWeight: 700, fontStyle: 'italic', fontSize: '11px', margin: '1px 0 0' }}>{l2}</p>}
                                {l3 && <p style={{ fontStyle: 'italic', fontSize: '10px', margin: '1px 0 0' }}>{l3}</p>}
                              </td>
                              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                              <td style={{ textAlign: 'right' }}>{fmtDE(item.unitPrice)}</td>
                              <td style={{ textAlign: 'right' }}>{fmtDE(item.quantity * item.unitPrice)}</td>
                            </tr>
                          )
                        })}
                        {isLast && (
                          <>
                            {hasDiscounts && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Summe Netto</td>
                                <td style={{ textAlign: 'right' }}>{fmtDE(productSubtotal)}</td>
                              </tr>
                            )}
                            {discountItems.map(item => (
                              <tr key={item.id}>
                                <td colSpan={2} style={{ fontStyle: 'italic', fontWeight: 700 }}>{item.description}</td>
                                <td style={{ textAlign: 'center' }}>1</td>
                                <td style={{ textAlign: 'right' }}>{fmtDE(Math.abs(item.unitPrice))}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Summe Netto</td>
                              <td style={{ textAlign: 'right' }}>{fmtDE(hasDiscounts ? productSubtotal - discountTotal : dn.subtotal)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'right', fontStyle: 'italic' }}>zzgl. MwSt. 19%</td>
                              <td style={{ textAlign: 'right' }}>{fmtDE(dn.vatAmount)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Gesamtsumme</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDE(dn.total)}</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              {dn.notes && (
                <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
                  <p style={{ textDecoration: 'underline', marginBottom: '4px' }}>Hinweis:</p>
                  <p>{dn.notes}</p>
                </div>
              )}

              <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.6, marginBottom: '20px' }}>
                Bitte prüfen Sie die Ware bei Erhalt auf Vollständigkeit und Unversehrtheit.
              </p>

              <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.8 }}>
                <p>Mit freundlichen Grüßen</p>
                <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos</p>
              </div>

            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
