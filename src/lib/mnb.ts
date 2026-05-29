function prevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

interface MnbRates {
  eur: number | null
  usd: number | null
}

async function fetchRatesForDate(date: string): Promise<MnbRates | null> {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRates xmlns="http://www.mnb.hu/webservices/">
      <startDate>${date}</startDate>
      <endDate>${date}</endDate>
      <currencyNames>EUR,USD</currencyNames>
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
  const decoded = xml
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  const eurMatch = decoded.match(/curr="EUR"[^>]*>([0-9,]+)</)
  const usdMatch = decoded.match(/curr="USD"[^>]*>([0-9,]+)</)

  if (!eurMatch && !usdMatch) return null

  return {
    eur: eurMatch ? parseFloat(eurMatch[1].replace(',', '.')) : null,
    usd: usdMatch ? parseFloat(usdMatch[1].replace(',', '.')) : null,
  }
}

export interface MnbRateResult {
  date: string
  eurHuf: number
  usdHuf: number
  eurUsd: number
}

/** Fetch EUR/HUF and USD/HUF MNB rates for a given date, retrying up to 7 previous days for weekends/holidays. */
export async function getMnbRates(date: string): Promise<MnbRateResult | null> {
  let d = date
  for (let i = 0; i < 7; i++) {
    const rates = await fetchRatesForDate(d)
    if (rates?.eur && rates?.usd) {
      return {
        date: d,
        eurHuf: rates.eur,
        usdHuf: rates.usd,
        eurUsd: parseFloat((rates.eur / rates.usd).toFixed(4)),
      }
    }
    d = prevDay(d)
  }
  return null
}

/** Fetch EUR/HUF MNB rate for a given date, retrying up to 7 previous days for weekends/holidays. */
export async function getMnbRate(date: string): Promise<{ date: string; rate: number } | null> {
  let d = date
  for (let i = 0; i < 7; i++) {
    const rates = await fetchRatesForDate(d)
    if (rates?.eur) return { date: d, rate: rates.eur }
    d = prevDay(d)
  }
  return null
}
