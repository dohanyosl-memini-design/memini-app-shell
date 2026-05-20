import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function prevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function fetchRateForDate(date: string): Promise<number | null> {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRates xmlns="http://www.mnb.hu/webservices/">
      <startDate>${date}</startDate>
      <endDate>${date}</endDate>
      <currencyNames>EUR</currencyNames>
    </GetExchangeRates>
  </soap:Body>
</soap:Envelope>`

  const res = await fetch('https://www.mnb.hu/arfolyamok.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.mnb.hu/webservices/GetExchangeRates',
    },
    body: soap,
  })

  const xml = await res.text()
  // Rate value uses Hungarian decimal comma, e.g. "395,47"
  const match = xml.match(/curr="EUR"[^>]*>([0-9,]+)</)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

// MNB doesn't publish on weekends/holidays — try up to 7 previous days
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  let date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  for (let i = 0; i < 7; i++) {
    const rate = await fetchRateForDate(date)
    if (rate) {
      return NextResponse.json({ date, rate })
    }
    date = prevDay(date)
  }

  return NextResponse.json({ error: 'MNB árfolyam nem elérhető' }, { status: 503 })
}
