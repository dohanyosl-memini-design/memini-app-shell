import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { storeImageForPiece } from '@/lib/imageProcessing'
import { logPieceEvent } from '@/lib/contentEvents'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const images = await prisma.contentImage.findMany({
    where: { pieceId: params.id },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(images)
}

// Multipart feltöltés: JPEG/PNG/HEIC → WebP → Blob → ContentImage.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Hiányzó fájl.' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'A fájl túl nagy (max 25 MB).' }, { status: 400 })
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const image = await storeImageForPiece(params.id, buffer, {
      contentType: file.type, filename: file.name, source: 'human',
    })
    await logPieceEvent(params.id, 'web', 'image_added', 'image', null, `${Math.round(image.bytes / 1024)} KB WebP`)
    return NextResponse.json(image, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Feltöltés sikertelen.' }, { status: 500 })
  }
}
