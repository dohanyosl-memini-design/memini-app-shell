import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

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
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        fileBlock,
        {
          type: 'text',
          text: `This is an OUTGOING invoice (Rechnung / bevételi számla) issued BY Laszlo Arpad Dohanyos e.U. TO a customer.

Extract the following data and return ONLY valid JSON, nothing else:
{
  "number": "invoice number (Rechnungs-Nr.) as string, or null",
  "date": "issue date (Rechnungsdatum) in YYYY-MM-DD format",
  "dueDate": "payment due date in YYYY-MM-DD format — calculate from issue date + Zahlungsfrist days if not explicit, or null",
  "billingName": "the CUSTOMER name (NOT Laszlo Arpad Dohanyos e.U.) — the company or person this invoice is addressed TO",
  "billingAddress": "customer street address, or null",
  "billingZip": "customer postal code, or null",
  "billingCity": "customer city, or null",
  "billingCountry": "customer country code (DE/HU/AT/etc), or null",
  "items": [
    {
      "description": "product or service description",
      "quantity": number,
      "unitPrice": net unit price as number,
      "vatRate": VAT percentage as number (e.g. 19),
      "isDiscount": false
    }
  ],
  "discounts": [
    {
      "description": "discount description",
      "amount": discount amount as positive number,
      "isDiscount": true
    }
  ],
  "subtotal": final net amount after discounts as number,
  "vatAmount": total VAT amount as number,
  "total": final gross total as number,
  "currency": "EUR or HUF",
  "isPaid": true if the invoice shows a paid stamp or marking, false otherwise
}

Important:
- Read ALL pages of the document
- billingName must be the RECIPIENT (customer), not the sender (Laszlo Arpad Dohanyos e.U.)
- Include ALL line items from all pages
- Include discounts separately in "discounts" array
- subtotal is the NET amount AFTER deducting discounts
- Return only the JSON object, no explanation`,
        },
      ],
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    return NextResponse.json({ ok: true, data: extracted })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not parse response', raw: text })
  }
}
