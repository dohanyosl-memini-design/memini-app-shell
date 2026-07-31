'use client'

import { Printer } from 'lucide-react'
import { format } from 'date-fns'

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  total: number
  isDiscount: boolean
}

interface Quote {
  id?: string
  number: string
  date: string
  validUntil: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
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
  items: QuoteItem[]
}

function fmtDE(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd.MM.yyyy')
}

const ITEMS_PER_PAGE = 5

export default function QuotePreview({ quote, printMode }: { quote: Quote; printMode?: boolean }) {
  const productItems = quote.items.filter(i => !i.isDiscount)
  const discountItems = quote.items.filter(i => i.isDiscount)
  const hasDiscounts = discountItems.length > 0
  const productSubtotal = productItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountTotal = discountItems.reduce((s, i) => s + Math.abs(i.unitPrice), 0)

  // Az áfa a tételek tényleges kulcsaiból, kulcsonként bontva — a számla
  // sablonjában ez 19%-ra van égetve, itt szándékosan nem.
  const vatGroups = Array.from(
    productItems.reduce((map, item) => {
      const net = item.quantity * item.unitPrice
      map.set(item.vatRate, (map.get(item.vatRate) ?? 0) + net * (item.vatRate / 100))
      return map
    }, new Map<number, number>()),
  ).sort((a, b) => a[0] - b[0])

  const chunks: typeof productItems[] = []
  for (let i = 0; i < productItems.length; i += ITEMS_PER_PAGE) {
    chunks.push(productItems.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const S = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px' }

  return (
    <div>
      {!printMode && (
        <div className="flex justify-end gap-2 mb-4 print:hidden">
          <button
            onClick={() => window.open(`/quotes/${quote.id}/print`, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
          >
            <Printer size={16} />
            Nyomtatás / PDF
          </button>
        </div>
      )}

      <div
        id="quote-print"
        className="bg-white border border-gray-200 rounded-lg"
        style={{ ...S, padding: '24px 32px', maxWidth: '640px', margin: '0 auto' }}
      >
        {/* ── FEJLÉC ── */}
        <div id="quote-header">
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
        <div id="quote-content">
          {/* Empfänger bal + Angebotsdetails jobb */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', marginBottom: '28px' }}>
            <div style={{ lineHeight: 1.6, fontSize: '12px' }}>
              {(() => {
                const name = quote.billingName || quote.company?.name || null
                const address = quote.billingAddress || quote.company?.address || null
                const zip = quote.billingZip || quote.company?.zip || null
                const city = quote.billingCity || quote.company?.city || null
                const phone = quote.company?.phone || null
                const email = quote.company?.email || null
                if (!name && !quote.contact) return null
                return (
                  <>
                    {name && name.split('\n').map((line, i) => (
                      <p key={i} style={{ fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? '13px' : '12px' }}>{line}</p>
                    ))}
                    {quote.contact && (
                      <p>{quote.contact.firstName} {quote.contact.lastName}</p>
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
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Angebots-Nr.:</td>
                    <td style={{ textAlign: 'right', fontWeight: 400 }}>{quote.number}</td>
                  </tr>
                  {quote.company?.customerNumber && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Kunden-Nr.:</td>
                      <td style={{ textAlign: 'right' }}>{quote.company.customerNumber}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ paddingRight: '20px', textAlign: 'left' }}>Angebotsdatum:</td>
                    <td style={{ textAlign: 'right' }}>{fmtDate(quote.date)}</td>
                  </tr>
                  {quote.validUntil && (
                    <tr>
                      <td style={{ paddingRight: '20px', textAlign: 'left' }}>Gültig bis:</td>
                      <td style={{ textAlign: 'right' }}>{fmtDate(quote.validUntil)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cím */}
          <h1 style={{ fontSize: '36px', fontWeight: 400, marginBottom: '10px', marginTop: '8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Angebot
          </h1>

          <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>
            vielen Dank für Ihr Interesse an unseren Produkten. Gerne unterbreiten wir Ihnen
            hiermit das folgende Angebot:
          </p>

          {/* Tételek — max 5/oldal */}
          {chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1
            return (
              <div key={chunkIndex} className={chunkIndex > 0 ? 'quote-page-break' : ''}>
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
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(hasDiscounts ? productSubtotal - discountTotal : quote.subtotal)}</td>
                        </tr>
                        {vatGroups.map(([rate, amount]) => (
                          <tr key={rate}>
                            <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontStyle: 'italic' }}>
                              zzgl. MwSt. {rate.toLocaleString('de-DE')}%
                            </td>
                            <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>{fmtDE(amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Gesamtsumme</td>
                          <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtDE(quote.total)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })}

          {quote.notes && (
            <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
              <p style={{ textDecoration: 'underline', marginBottom: '4px' }}>Hinweis:</p>
              <p>{quote.notes}</p>
            </div>
          )}

          <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.6, marginBottom: '20px' }}>
            {quote.validUntil ? `Dieses Angebot ist gültig bis zum ${fmtDate(quote.validUntil)}. ` : ''}
            Alle Preise verstehen sich netto zzgl. der gesetzlichen Mehrwertsteuer.
            Für eine Bestellung genügt eine kurze Rückmeldung per E-Mail — wir bestätigen
            Ihnen den Auftrag anschließend mit einer Auftragsbestätigung.
            Bei Fragen stehe ich Ihnen jederzeit gerne zur Verfügung.
          </p>

          <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.8 }}>
            <p>Mit freundlichen Grüßen</p>
            <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos</p>
          </div>
        </div>

        {/* ── LÁBLÉC ── */}
        <div id="quote-footer">
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
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 54mm 18mm 36mm 18mm; }

          html, body { height: auto !important; overflow: visible !important; background: white !important; }
          .h-screen { height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-auto { overflow: visible !important; height: auto !important; }
          .pb-16 { padding-bottom: 0 !important; }
          .bg-slate-900 { display: none !important; }

          #quote-print {
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #quote-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 8mm 18mm 4mm !important;
            background: white !important;
          }

          #quote-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 0 18mm 8mm !important;
            background: white !important;
          }

          #quote-content {
            padding-bottom: 12mm !important;
          }

          .quote-page-break {
            page-break-before: always !important;
            break-before: page !important;
            padding-top: 8px;
          }

          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
