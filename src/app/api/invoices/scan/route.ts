import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'

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
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        fileBlock,
        {
          type: 'text',
          text: `Ez egy kiállított bevételi számla (nem kiadási). Olvasd ki az adatokat és adj vissza CSAK valid JSON-t, semmi mást:
{
  "number": "számlaszám vagy null",
  "date": "ÉÉÉÉ-HH-NN kiállítás dátuma",
  "dueDate": "ÉÉÉÉ-HH-NN fizetési határidő, vagy null ha nem látható",
  "billingName": "vevő/ügyfél neve",
  "billingAddress": "vevő utca, házszám vagy null",
  "billingZip": "vevő irányítószám vagy null",
  "billingCity": "vevő város vagy null",
  "billingCountry": "vevő ország kódja (DE/HU/AT) vagy null",
  "items": [
    {
      "description": "tétel leírása",
      "quantity": 1,
      "unitPrice": 100.00,
      "vatRate": 19
    }
  ],
  "subtotal": nettó összeg számként,
  "vatAmount": ÁFA összeg számként,
  "total": bruttó végösszeg számként,
  "currency": "EUR vagy HUF",
  "isPaid": true ha látszik befizetettség/pecsét/stamp, false ha nem
}

Ha egy mező nem látható, használj null-t. Csak a JSON objektumot add vissza.`,
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
