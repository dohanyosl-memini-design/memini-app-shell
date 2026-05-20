import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

const client = new Anthropic()

const CATEGORY_LIST = [
  'Mobilszámla',
  'Program / Applikáció',
  'Tárhely',
  'AI előfizetés',
  'Alapanyagköltség',
  'Termékköltség',
  'Szállítás',
  'Marketing',
  'Irodaszer',
  'Könyvelő',
  'Egyéb',
]

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

Category list (pick the best match or null if none fits):
${CATEGORY_LIST.join(', ')}

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
    return NextResponse.json({ ok: true, data: extracted })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not parse response', raw: text })
  }
}
