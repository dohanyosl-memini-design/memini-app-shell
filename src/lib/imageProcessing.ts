// Kép-feldolgozás (marketing) — JPEG/PNG/HEIC → WebP konverzió (sharp),
// méret-korlátozással, Vercel Blob tárolással. Közös motor a felületi
// feltöltéshez és az MCP URL-ingesztáláshoz.

import sharp from 'sharp'
import heicConvert from 'heic-convert'
import { put, del } from '@vercel/blob'
import { prisma } from './prisma'

const MAX_WIDTH = 1600
const WEBP_QUALITY = 80

function isHeic(contentType?: string | null, filename?: string): boolean {
  const ct = (contentType || '').toLowerCase()
  const fn = (filename || '').toLowerCase()
  return ct.includes('heic') || ct.includes('heif') || fn.endsWith('.heic') || fn.endsWith('.heif')
}

// Tetszőleges kép-bájtokból WebP + metaadat. HEIC-et előbb JPEG-re konvertál.
export async function toWebp(
  input: Buffer,
  opts: { contentType?: string | null; filename?: string } = {}
): Promise<{ buffer: Buffer; width: number; height: number; bytes: number }> {
  let source = input
  if (isHeic(opts.contentType, opts.filename)) {
    const jpeg = await heicConvert({ buffer: input, format: 'JPEG', quality: 0.92 })
    source = Buffer.from(jpeg)
  }
  const img = sharp(source, { failOn: 'none' }).rotate() // EXIF auto-orient
  const meta = await img.metadata()
  const pipeline = meta.width && meta.width > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img
  const out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true })
  return { buffer: out.data, width: out.info.width, height: out.info.height, bytes: out.info.size }
}

// WebP-t (URL-ről) JPEG-re konvertál — a "letöltés JPEG-ként" opcióhoz.
export async function webpUrlToJpeg(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Kép nem letölthető: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return sharp(buf).jpeg({ quality: 92 }).toBuffer()
}

/**
 * Kép hozzáadása egy tartalomhoz: WebP-be konvertálja, Blobba tölti, létrehozza
 * a ContentImage sort. Az első kép automatikusan borító lesz (isPrimary +
 * piece.imageUrl gyorshivatkozás).
 */
export async function storeImageForPiece(
  pieceId: string,
  input: Buffer,
  opts: { contentType?: string | null; filename?: string; source?: string } = {}
): Promise<{ id: string; url: string; width: number; height: number; bytes: number }> {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: pieceId },
    select: { id: true, _count: { select: { images: true } } },
  })
  if (!piece) throw new Error('Tartalom nem található.')

  const { buffer, width, height, bytes } = await toWebp(input, opts)
  const blob = await put(`marketing/${pieceId}/${Date.now()}.webp`, buffer, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: true,
  })

  const isFirst = piece._count.images === 0
  const image = await prisma.contentImage.create({
    data: {
      pieceId,
      url: blob.url,
      isPrimary: isFirst,
      width, height, bytes,
      source: opts.source || 'human',
      sortOrder: piece._count.images,
    },
  })
  if (isFirst) {
    await prisma.contentPiece.update({ where: { id: pieceId }, data: { imageUrl: blob.url } })
  }
  return { id: image.id, url: image.url, width, height, bytes }
}

// URL-ből ingesztálás (MCP): letölti, majd storeImageForPiece.
export async function ingestImageFromUrl(pieceId: string, url: string, source = 'agent') {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Kép nem letölthető: ${res.status}`)
  const contentType = res.headers.get('content-type')
  const buf = Buffer.from(await res.arrayBuffer())
  return storeImageForPiece(pieceId, buf, { contentType, source })
}

// Kép törlése: a Blobból is, és ha borító volt, új borítót jelöl ki.
export async function deleteContentImage(imageId: string): Promise<void> {
  const image = await prisma.contentImage.findUnique({ where: { id: imageId } })
  if (!image) return
  await prisma.contentImage.delete({ where: { id: imageId } })
  await del(image.url).catch(() => {})
  if (image.isPrimary) {
    const next = await prisma.contentImage.findFirst({ where: { pieceId: image.pieceId }, orderBy: { sortOrder: 'asc' } })
    if (next) {
      await prisma.contentImage.update({ where: { id: next.id }, data: { isPrimary: true } })
      await prisma.contentPiece.update({ where: { id: image.pieceId }, data: { imageUrl: next.url } })
    } else {
      await prisma.contentPiece.update({ where: { id: image.pieceId }, data: { imageUrl: null } })
    }
  }
}

// Borítókép beállítása.
export async function setPrimaryImage(imageId: string): Promise<void> {
  const image = await prisma.contentImage.findUnique({ where: { id: imageId } })
  if (!image) throw new Error('Kép nem található.')
  await prisma.contentImage.updateMany({ where: { pieceId: image.pieceId }, data: { isPrimary: false } })
  await prisma.contentImage.update({ where: { id: imageId }, data: { isPrimary: true } })
  await prisma.contentPiece.update({ where: { id: image.pieceId }, data: { imageUrl: image.url } })
}
