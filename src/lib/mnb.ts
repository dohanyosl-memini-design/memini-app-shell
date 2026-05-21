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
  const decoded = xml
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  const match = decoded.match(/curr="EUR"[^>]*>([0-9,]+)</)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

/** Fetch EUR/HUF MNB rate for a given date, retrying up to 7 previous days for weekends/holidays. */
export async function getMnbRate(date: string): Promise<{ date: string; rate: number } | null> {
  let d = date
  for (let i = 0; i < 7; i++) {
    const rate = await fetchRateForDate(d)
    if (rate) return { date: d, rate }
    d = prevDay(d)
  }
  return null
}
