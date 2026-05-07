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
}

interface Invoice {
  number: string
  date: string
  dueDate: string
  deliveryInfo: string | null
  status: string
  currency: string
  subtotal: number
  vatAmount: number
  total: number
  paidAt: string | null
  notes: string | null
  contact: { firstName: string; lastName: string } | null
  company: {
    name: string
    address: string | null
    city: string | null
    vatId: string | null
    phone: string | null
    email: string | null
    customerNumber: string | null
  } | null
  items: InvoiceItem[]
}

function fmtDE(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd.MM.yyyy')
}

export default function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const paymentDays = differenceInDays(new Date(invoice.dueDate), new Date(invoice.date))

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
        id="invoice-print"
        className="bg-white border border-gray-200 rounded-lg print:border-0 print:rounded-none"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', padding: '32px 40px', maxWidth: '800px', margin: '0 auto' }}
      >
        {/* ── Fejléc: logo + feladó cím (jobb oldal) ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            {/* MEMiNi DESIGN logo */}
            <div style={{ lineHeight: 1, marginBottom: '6px' }}>
              <div style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: '34px', letterSpacing: '-1px', lineHeight: 1 }}>
                ME<span style={{ fontWeight: 400, fontSize: '30px' }}>mi</span>N<span style={{ fontWeight: 400, fontSize: '30px' }}>i</span>
              </div>
              <div style={{ fontSize: '9px', letterSpacing: '5px', fontWeight: 400, marginTop: '-2px', paddingLeft: '2px' }}>DESIGN</div>
            </div>
            <div style={{ marginTop: '10px', lineHeight: 1.5 }}>
              <p style={{ fontWeight: 700, fontSize: '12px' }}>Laszlo Arpad Dohanyos e.U.</p>
              <p style={{ fontSize: '11px' }}>Laszlo Arpad Dohanyos</p>
              <p style={{ fontSize: '11px' }}>Römerstraße 32</p>
              <p style={{ fontSize: '11px' }}>89077 Ulm</p>
            </div>
          </div>
        </div>

        {/* ── Visszacím sáv ── */}
        <div style={{ fontSize: '9px', color: '#444', borderBottom: '1px solid #888', paddingBottom: '4px', marginBottom: '20px' }}>
          Laszlo Arpad Dohanyos e.U.&nbsp;&nbsp;│&nbsp;&nbsp;Römerstraße 32&nbsp;&nbsp;│&nbsp;&nbsp;89077 Ulm
        </div>

        {/* ── Empfänger bal + Rechnungsdetails jobb ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          {/* Bal: címzett */}
          <div style={{ lineHeight: 1.6, fontSize: '12px' }}>
            {invoice.company ? (
              <>
                <p style={{ fontWeight: 700, fontSize: '13px' }}>{invoice.company.name}</p>
                {invoice.contact && (
                  <p>{invoice.contact.firstName} {invoice.contact.lastName}</p>
                )}
                <div style={{ marginTop: '8px' }}>
                  {invoice.company.address && <p>{invoice.company.address},</p>}
                  {invoice.company.city && <p>{invoice.company.city}</p>}
                  {invoice.company.phone && <p>Tel.: {invoice.company.phone}</p>}
                  {invoice.company.email && <p>E-Mail: {invoice.company.email}</p>}
                </div>
              </>
            ) : invoice.contact ? (
              <p style={{ fontWeight: 700 }}>{invoice.contact.firstName} {invoice.contact.lastName}</p>
            ) : null}
          </div>

          {/* Jobb: számla adatok, dőlt */}
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

        {/* ── Cím: Rechnung ── */}
        <h1 style={{ fontSize: '36px', fontWeight: 400, marginBottom: '10px', marginTop: '8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          Rechnung
        </h1>

        {/* ── Bevezető szöveg ── */}
        <p style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '20px', lineHeight: 1.5 }}>
          Ich danke Ihnen herzlich für Ihr Vertrauen in unsere Produkte und werde Ihnen nun, gemäß unserer
          Vereinbarung, die folgenden Lieferungen in Rechnung stellen:
        </p>

        {/* ── Tételek táblázat ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '24px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'left', fontWeight: 700, backgroundColor: '#fff' }}>
                Produktbezeichnung
              </th>
              <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '80px', backgroundColor: '#fff' }}>
                Menge<br />(Stück)
              </th>
              <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '110px', backgroundColor: '#fff' }}>
                Preis<br />(€&nbsp;/&nbsp;Stück)
              </th>
              <th style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'center', fontWeight: 700, width: '110px', backgroundColor: '#fff' }}>
                Gesamtpreis<br />(€)
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td style={{ border: '1px solid #333', padding: '8px 10px', fontStyle: 'italic', fontWeight: 700 }}>
                  {item.description}
                </td>
                <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'center' }}>
                  {item.quantity}
                </td>
                <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'right' }}>
                  {fmtDE(item.unitPrice)}
                </td>
                <td style={{ border: '1px solid #333', padding: '8px 10px', textAlign: 'right' }}>
                  {fmtDE(item.total)}
                </td>
              </tr>
            ))}

            {/* Összesítő sorok */}
            <tr>
              <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>
                Summe Netto
              </td>
              <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>
                {fmtDE(invoice.subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontStyle: 'italic' }}>
                zzgl. MwSt. 19%
              </td>
              <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right' }}>
                {fmtDE(invoice.vatAmount)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>
                Gesamtsumme
              </td>
              <td style={{ border: '1px solid #333', padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>
                {fmtDE(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Megjegyzés (opcionális) ── */}
        {invoice.notes && (
          <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
            <p style={{ textDecoration: 'underline', marginBottom: '4px' }}>Hinweis:</p>
            <p>{invoice.notes}</p>
          </div>
        )}

        {/* ── Záró szöveg ── */}
        <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.6, marginBottom: '32px' }}>
          Die Zahlung erfolgt innerhalb von {paymentDays} Tagen ab Rechnungseingang ohne Abzüge auf das unten
          angegebene Bankkonto. Ich danke Ihnen für Ihren Auftrag und freue mich auf die weitere Zusammenarbeit.
        </p>

        {/* ── Aláírás ── */}
        <div style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '60px', lineHeight: 1.8 }}>
          <p>Mit freundlichen Grüßen</p>
          <p style={{ fontWeight: 700 }}>Laszlo Arpad Dohanyos</p>
        </div>

        {/* ── Lábléc 3 oszlop ── */}
        <div style={{ borderTop: '1px solid #333', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '10px', lineHeight: 1.6 }}>
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
          @page { size: A4; margin: 15mm 20mm; }
          body * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
