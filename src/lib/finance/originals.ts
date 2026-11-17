/**
 * Az eredeti bizonylat tárolása és a szerver-oldali hash-ellenőrzés.
 *
 * A ChatGPT megadja a fájl SHA-256-ját, de a fájlt nem látja a szerver — így a
 * hash eddig csak állítás volt. Itt a szerver MAGA számolja ki a feltöltött
 * bájtokból, és csak egyezésnél csatolja: ekkor lesz a dokumentum „ellenőrzött".
 * Az eredeti fájl soha nem módosul; a tárolási útvonal a hash-ből képződik, így a
 * feltöltés idempotens.
 */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface OriginalStore {
  /** Eltárolja a bájtokat, és visszaadja a tárolási hivatkozást. */
  put(pathname: string, bytes: Buffer, contentType: string): Promise<string>
  get(ref: string): Promise<{ stream: ReadableStream<Uint8Array> } | null>
}

/** Vercel Blob, PRIVÁT hozzáféréssel (a pénzügyi bizonylat nem lehet nyilvános URL). */
export const blobStore: OriginalStore = {
  async put(pathname, bytes, contentType) {
    const { put } = await import('@vercel/blob')
    try {
      const r = await put(pathname, bytes, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true })
      return r.pathname
    } catch (e) {
      throw new Error(
        `A privát Blob-tárolás nem sikerült: ${e instanceof Error ? e.message : String(e)}. `
        + 'Ellenőrizd, hogy a BLOB_READ_WRITE_TOKEN be van állítva, és a Blob-tároló privát hozzáférést támogat.',
      )
    }
  },
  async get(ref) {
    const { get } = await import('@vercel/blob')
    const r = await get(ref, { access: 'private' })
    return r && r.statusCode === 200 ? { stream: r.stream } : null
  },
}

/**
 * Helyi fejlesztéshez / teszthez: fájlrendszeri tároló. KIZÁRÓLAG akkor aktív, ha a
 * FINANCE_LOCAL_ORIGINALS_DIR változó ki van állítva — éles környezetben nem szabad
 * beállítani, mert a szerver-oldali lemez ott ideiglenes (a fájl elveszne). Ha a
 * változó hiányzik, mindig a privát Blob az alapértelmezett, csendes visszaesés nincs.
 */
function fsStore(dir: string): OriginalStore {
  return {
    async put(pathname, bytes) {
      const { mkdir, writeFile } = await import('node:fs/promises')
      const { dirname, join, resolve } = await import('node:path')
      const target = resolve(join(dir, pathname))
      if (!target.startsWith(resolve(dir))) throw new Error('Érvénytelen tárolási útvonal.')
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
      return pathname
    },
    async get(ref) {
      const { readFile } = await import('node:fs/promises')
      const { join, resolve } = await import('node:path')
      const target = resolve(join(dir, ref))
      if (!target.startsWith(resolve(dir))) return null
      try {
        // A fájlok legfeljebb 4 MB-osak, ezért egészben olvassuk, és abból építünk folyamot.
        const bytes = await readFile(target)
        return { stream: new Response(bytes).body as ReadableStream<Uint8Array> }
      } catch { return null }
    },
  }
}

export function defaultStore(): OriginalStore {
  const dir = process.env.FINANCE_LOCAL_ORIGINALS_DIR
  return dir ? fsStore(dir) : blobStore
}

export const MAX_ORIGINAL_BYTES = 4 * 1024 * 1024 // a Vercel függvény kérés-mérete ~4,5 MB
const ALLOWED = new Set(['pdf', 'xml', 'png', 'jpg', 'jpeg'])

export const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file'

/** A fájl tényleg az, aminek mondja magát? (kiterjesztés + első bájtok) */
export function sniff(filename: string, bytes: Buffer): { ok: true; mime: string } | { ok: false; reason: string } {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED.has(ext)) return { ok: false, reason: `Nem támogatott fájltípus (.${ext}). Támogatott: pdf, xml, png, jpg.` }
  const head = bytes.subarray(0, 8)
  const startsWith = (s: string) => head.subarray(0, s.length).toString('latin1') === s
  if (ext === 'pdf') return startsWith('%PDF') ? { ok: true, mime: 'application/pdf' } : { ok: false, reason: 'A fájl nem érvényes PDF (hiányzik a %PDF fejléc).' }
  if (ext === 'png') return head[0] === 0x89 && startsWith('\x89PNG') ? { ok: true, mime: 'image/png' } : { ok: false, reason: 'A fájl nem érvényes PNG.' }
  if (ext === 'jpg' || ext === 'jpeg') return head[0] === 0xff && head[1] === 0xd8 ? { ok: true, mime: 'image/jpeg' } : { ok: false, reason: 'A fájl nem érvényes JPEG.' }
  const text = bytes.subarray(0, 200).toString('utf8').trimStart()
  return text.startsWith('<') ? { ok: true, mime: 'application/xml' } : { ok: false, reason: 'A fájl nem érvényes XML.' }
}

export type AttachResult =
  | { outcome: 'attached'; documentId: string; sha256: string }
  | { outcome: 'already_attached'; documentId: string; sha256: string }
  | { outcome: 'no_record'; sha256: string; candidates: { id: string; originalFilename: string; claimedSha256: string }[] }
  | { outcome: 'hash_adopted'; documentId: string; sha256: string; previousClaim: string }
  | { outcome: 'rejected'; reason: string; sha256?: string }

/**
 * Feltöltött fájl csatolása. A rekordot a szerver által számolt hash alapján keresi.
 * Ha nincs ilyen hash, a hívó (ChatGPT) valószínűleg rosszat számolt — ilyenkor a
 * nevében egyező, még nem ellenőrzött rekordokat javasoljuk, és az ember dönthet:
 * `adoptFor` megadásával a rekord hash-ét a VALÓDI fájl hash-ére javítjuk (naplózva).
 */
export async function attachOriginal(
  input: { filename: string; bytes: Buffer; actor: string; adoptFor?: string | null },
  deps: { db?: PrismaClient; store?: OriginalStore } = {},
): Promise<AttachResult> {
  const db = deps.db ?? prisma
  const store = deps.store ?? defaultStore()
  const { filename, bytes, actor } = input

  if (bytes.length === 0) return { outcome: 'rejected', reason: 'Üres fájl.' }
  if (bytes.length > MAX_ORIGINAL_BYTES) return { outcome: 'rejected', reason: `A fájl túl nagy (${(bytes.length / 1048576).toFixed(1)} MB, a határ 4 MB).` }
  const kind = sniff(filename, bytes)
  if (!kind.ok) return { outcome: 'rejected', reason: kind.reason }

  const sha = sha256Of(bytes)
  let doc = await db.financialDocument.findUnique({ where: { sha256: sha } })
  let adopted: string | null = null

  if (!doc && input.adoptFor) {
    const target = await db.financialDocument.findUnique({ where: { id: input.adoptFor } })
    if (!target) return { outcome: 'rejected', reason: 'A megadott rekord nem található.', sha256: sha }
    if (target.hashVerifiedAt) return { outcome: 'rejected', reason: 'Ennél a rekordnál a hash már igazolt, nem cserélhető.', sha256: sha }
    if (target.status !== 'needs_review') return { outcome: 'rejected', reason: `A hash csak ellenőrzésre váró rekordnál javítható (állapot: ${target.status}).`, sha256: sha }
    adopted = target.sha256
    doc = await db.financialDocument.update({ where: { id: target.id }, data: { sha256: sha } })
    await db.financialDocumentEvent.create({
      data: { documentId: target.id, actor, action: 'corrected', detail: { field: 'sha256', before: adopted, after: sha, reason: 'A szerver a feltöltött fájlból számolt hash-re javította (ember jóváhagyásával).' } },
    })
  }

  if (!doc) {
    const sameName = await db.financialDocument.findMany({
      where: { originalFilename: filename, hashVerifiedAt: null }, select: { id: true, originalFilename: true, sha256: true }, take: 5,
    })
    return { outcome: 'no_record', sha256: sha, candidates: sameName.map((d) => ({ id: d.id, originalFilename: d.originalFilename, claimedSha256: d.sha256 })) }
  }

  if (doc.hashVerifiedAt && doc.storageUrl) return { outcome: 'already_attached', documentId: doc.id, sha256: sha }

  const ref = await store.put(`finance-originals/${sha}/${safeName(filename)}`, bytes, kind.mime)
  await db.$transaction([
    db.financialDocument.update({
      where: { id: doc.id },
      data: { storageUrl: ref, hashVerifiedAt: new Date(), sizeBytes: bytes.length, mimeType: kind.mime },
    }),
    db.financialDocumentEvent.create({
      data: { documentId: doc.id, actor, action: 'linked', detail: { what: 'original_attached', sha256: sha, sizeBytes: bytes.length, filename } },
    }),
  ])
  return adopted
    ? { outcome: 'hash_adopted', documentId: doc.id, sha256: sha, previousClaim: adopted }
    : { outcome: 'attached', documentId: doc.id, sha256: sha }
}
