import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { webpUrlToJpeg } from '@/lib/imageProcessing'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// A tárolt WebP-t JPEG-ként adja vissza letöltésre (posztoláshoz).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const image = await prisma.contentImage.findUnique({ where: { id: params.id } })
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const jpeg = await webpUrlToJpeg(image.url)
    return new NextResponse(jpeg as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="memini-${image.id}.jpg"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Konverzió sikertelen.' }, { status: 500 })
  }
}
