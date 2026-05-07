import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const file = form.get('file') as File

  if (!file || !file.size) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedMime = ['image/jpeg', 'image/webp', 'image/jpg']
  const allowedExt = ['jpg', 'jpeg', 'webp']
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!allowedMime.includes(file.type) && !allowedExt.includes(ext)) {
    return NextResponse.json({ error: 'Only JPEG and WebP allowed' }, { status: 400 })
  }

  const contentType = file.type || (ext === 'webp' ? 'image/webp' : 'image/jpeg')

  const blob = await put(`products/${Date.now()}-${file.name}`, file, {
    access: 'public',
    contentType,
  })

  return NextResponse.json({ url: blob.url })
}
