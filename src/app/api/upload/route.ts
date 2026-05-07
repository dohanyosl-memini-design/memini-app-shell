import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ext = pathname.split('.').pop()?.toLowerCase() || ''
        if (!['jpg', 'jpeg', 'webp'].includes(ext)) {
          throw new Error('Csak JPEG és WebP formátum engedélyezett')
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/webp', 'image/jpg'],
          maximumSizeInBytes: 4 * 1024 * 1024,
        }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
