import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

const client = new Anthropic()

const CATEGORY_LIST = [
  'Termékköltség',
  'Alapanyag',
  'Gyártás',
  'Munkabér',
  'Marketing',
  'Szoftver & App-ok',
  'Tárhely',
  'Könyvelés',
  'Irodai kellékek',
  'Utazás & Üzemanyag',
  'Autóköltség',
  'Szállítás (kimenő)',
  'Bankköltség',
  'Biztosítás',
  'Kommunikáció',
  'Javítás & Karbantartás',
  'Oktatás',
  'Coaching',
  'Egyéb',
]

const CATEGORY_HINTS = `
- Termékköltség: finished goods bought for resale, merchandise purchase
- Alapanyag: raw materials, ingredients used in production/manufacturing
- Gyártás: production equipment, manufacturing tools, factory costs
- Munkabér: salaries, wages, payroll, contractor payments, employee costs
- Marketing: advertising, social media ads, design, promotion, branding
- Szoftver & App-ok: software subscriptions, SaaS tools, apps, licenses, AI tools
- Tárhely: web hosting, cloud storage, domain names, server costs
- Könyvelés: accounting services, bookkeeping, tax consulting, auditing
- Irodai kellékek: office supplies, stationery, paper, pens, printer ink
- Utazás & Üzemanyag: business travel, fuel for work trips, train/flight tickets
- Autóköltség: car maintenance, vehicle repairs, car insurance, leasing
- Szállítás (kimenő): shipping products to customers, courier services, freight
- Bankköltség: bank fees, wire transfer fees, payment processing fees
- Biztosítás: any insurance premiums (business, liability, property)
- Kommunikáció: phone bills, internet, mobile plans, VoIP
- Javítás & Karbantartás: repairs of equipment, maintenance services
- Oktatás: courses, training, e-learning platforms, books, educational materials
- Coaching: business coaching, mentoring, consulting sessions
- Egyéb: anything that doesn't fit the above categories
`

function prevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function fetchMnbRate(date: string): Promise<{ rate: number; date: string } | null> {
  let current = date
  for (let i = 0; i < 7; i++) {
    try {
      const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRates xmlns="http://www.mnb.hu/webservices/">
      <startDate>${current}</startDate>
      <endDate>${current}</endDate>
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
        signal: AbortSignal.timeout(8000),
      })
      const xml = await res.text()
      const match = xml.match(/curr="EUR"[^>]*>([0-9,]+)</)
      if (match) return { rate: parseFloat(match[1].replace(',', '.')), date: current }
    } catch { /* try previous day */ }
    current = prevDay(current)
  }
  return null
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  let imageBase64: string
  let mediaType: string

  if (file.type === 'image/heic' || file.type === 'image/heif') {
    const jpegBuffer = await heicConvert({ buffer: Buffer.from(bytes), format: 'JPEG', quality: 0.9 })
    imageBase64 = Buffer.from(jpegBuffer).toString('base64')
    mediaType = 'image/jpeg'
  } else {
    imageBase64 = Buffer.from(bytes).toString('base64')
    mediaType = file.type
  }

  const isPdf = mediaType === 'application/pdf'
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const imageType = validImageTypes.includes(mediaType) ? mediaType : 'image/jpeg'

  type ContentBlock =
    | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }

  const fileBlock: ContentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: imageType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 } }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text: `Extract the following fields from this receipt/invoice and return ONLY valid JSON, no explanation:
{
  "vendor": "shop or company name",
  "date": "YYYY-MM-DD format",
  "amount": net amount as number without currency symbol,
  "vatAmount": VAT/tax amount as number (0 if not visible),
  "totalAmount": total gross amount as number (amount + vatAmount),
  "description": "brief description of what was purchased",
  "reference": "invoice or receipt number if visible",
  "category": "best matching category from the list below, or null",
  "currency": "EUR or HUF based on the currency shown on the receipt"
}

Pick the best matching category from this list (or null if nothing fits):
${CATEGORY_LIST.join(', ')}

Category matching guide:
${CATEGORY_HINTS}

If a field cannot be determined, use null. Return only the JSON object.`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    // Auto-convert HUF → EUR using MNB rate on the invoice date
    if (extracted.currency === 'HUF' && extracted.totalAmount && extracted.date) {
      const mnb = await fetchMnbRate(extracted.date)
      if (mnb) {
        extracted.eurRate   = mnb.rate
        extracted.eurAmount = Math.round((extracted.totalAmount / mnb.rate) * 100) / 100
        extracted.eurRateDate = mnb.date
      }
    }

    return NextResponse.json({ ok: true, data: extracted })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not parse response', raw: text })
  }
}
