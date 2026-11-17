import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DOC_KINDS } from './prepare'
import type { RawDocInput } from './prepare'
import { recordDocuments, getDocument, listDocuments, getBatchStatus, listImportErrors } from './documents'

const ACTOR = 'Arthur'

const text = (data: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

const fail = (what: string, e: unknown) =>
  text({ status: 'failed', error: `${what}: ${e instanceof Error ? e.message : String(e)}` }, true)

/**
 * Pénzügyi dokumentumtár MCP-eszközei. A jóváhagyás/rögzítés SZÁNDÉKOSAN nincs
 * köztük: az ügynök importál és olvas, a jóváhagyás a webes felületen, emberi
 * jogosultsággal történik — így a saját importját nem hagyhatja jóvá.
 */
export function registerFinanceTools(server: McpServer) {
  server.tool(
    'import_financial_batch',
    'Pénzügyi bizonylatok (számlák, sztornók, jóváírások, nyugták) kötegelt rögzítése a dokumentumtárba. '
    + 'Egy hívásban legfeljebb 50 dokumentum. IDEMPOTENS: ugyanaz az eredeti fájl (sha256) kétszer nem hoz létre új tételt, '
    + 'a hívás biztonsággal újraindítható. NEM ír a meglévő számla/kiadás táblákba, és NEM hagy jóvá semmit: minden tétel '
    + '"needs_review" állapotba kerül, a jóváhagyás emberi, a webes felületen történik. '
    + 'SZABÁLYOK: (1) az sha256 az ORIGINAL fájl bájtjaiból számolt legyen, ne találd ki; (2) a hiányzó adatot HAGYD KI, ne tippeld; '
    + '(3) az összegek tizedes számok ponttal (1097.18, nem "1.097,18"), sztornónál/jóváírásnál NEGATÍV; (4) a dátum YYYY-MM-DD; '
    + '(5) a válasz tételenként megmondja: created / already_known / rejected / error, és mi vár emberi döntésre — ezt add vissza a felhasználónak.',
    {
      documents: z.array(z.object({
        original_filename: z.string().describe('Az eredeti fájlnév, ahogy a csomagban volt'),
        sha256: z.string().describe('Az eredeti fájl SHA-256 hash-e, 64 hexa karakter'),
        kind: z.enum(DOC_KINDS).describe('Dokumentumtípus. Ne tekints minden PDF-et számlának: bankkivonat, nyugta, egyéb is lehet.'),
        direction: z.enum(['outgoing', 'incoming']).optional().describe('Kimenő (mi állítottuk ki) vagy bejövő. Számlánál a típusból következik.'),
        mime_type: z.string().optional(),
        size_bytes: z.number().int().optional(),
        external_number: z.string().optional().describe('Az EREDETI számlaszám a dokumentumról (nem a CRM-é)'),
        issue_date: z.string().optional().describe('Kiállítás dátuma, YYYY-MM-DD'),
        supply_date: z.string().optional().describe('Teljesítés dátuma, YYYY-MM-DD'),
        due_date: z.string().optional().describe('Fizetési határidő, YYYY-MM-DD'),
        issuer_name: z.string().optional().describe('Kibocsátó neve'),
        issuer_vat_id: z.string().optional().describe('Kibocsátó adószáma / USt-IdNr, ha szerepel'),
        recipient_name: z.string().optional(),
        recipient_vat_id: z.string().optional(),
        currency: z.string().optional().describe('3 betűs kód, pl. EUR'),
        net: z.number().optional().describe('Nettó végösszeg, tizedes szám'),
        vat: z.number().optional().describe('ÁFA összesen, tizedes szám'),
        gross: z.number().optional().describe('Bruttó végösszeg, tizedes szám'),
        line_nets: z.array(z.number()).optional().describe('A sorok nettó összegei, ha olvashatók (soronkénti ellenőrzéshez)'),
        related_number: z.string().optional().describe('Sztornó/jóváírás/helyesbítő esetén az ELTÉRŐ eredeti számla száma'),
        source_json: z.string().optional().describe('A kinyert adat teljes részletei JSON-SZÖVEGKÉNT (JSON.stringify): tételsorok, fizetési hivatkozás stb.'),
      })).min(1).max(50),
      batch: z.object({
        filename: z.string().describe('A ZIP fájlneve'),
        sha256: z.string().describe('A ZIP SHA-256 hash-e'),
        size_bytes: z.number().int().optional(),
        total_files: z.number().int().optional().describe('Hány fájl van a csomagban ÖSSZESEN — így látszik, ha valami nem került be'),
        final: z.boolean().optional().describe('true = ez a köteg utolsó hívása (lezárja a kötegelt feldolgozást)'),
      }).optional().describe('Ha egy ZIP részeként küldöd, add meg — több hívásra bontva is egy köteg marad'),
    },
    async (i) => {
      try {
        const report = await recordDocuments(i.documents as RawDocInput[], { actor: ACTOR, batch: i.batch ?? null })
        return text(report, report.status === 'failed')
      } catch (e) {
        return fail('Az import nem sikerült', e)
      }
    },
  )

  server.tool(
    'get_financial_document',
    'Egy pénzügyi dokumentum teljes adata a naplójával együtt — id vagy sha256 alapján. Import után ezzel olvasd vissza és ellenőrizd az eredményt.',
    { id_or_sha256: z.string().describe('A dokumentum azonosítója vagy az eredeti fájl SHA-256 hash-e') },
    async ({ id_or_sha256 }) => {
      try {
        const doc = await getDocument(id_or_sha256)
        return doc ? text(doc) : text({ status: 'failed', error: 'Nincs ilyen dokumentum.' }, true)
      } catch (e) { return fail('A lekérdezés nem sikerült', e) }
    },
  )

  server.tool(
    'list_financial_documents',
    'Pénzügyi dokumentumok listázása. Szűrhető állapot, típus, irány és köteg szerint. A válasz a teljes találatszámot is megadja.',
    {
      status: z.enum(['received', 'extracted', 'needs_review', 'recorded', 'duplicate', 'rejected', 'error']).optional(),
      kind: z.enum(DOC_KINDS).optional(),
      direction: z.enum(['outgoing', 'incoming']).optional(),
      batch_id: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Alapértelmezett: 50'),
    },
    async (i) => {
      try {
        return text(await listDocuments({ status: i.status, kind: i.kind, direction: i.direction, batchId: i.batch_id, limit: i.limit }))
      } catch (e) { return fail('A listázás nem sikerült', e) }
    },
  )

  server.tool(
    'get_import_status',
    'Egy import-köteg (ZIP) állapota: állapot szerinti darabszámok, a bejelentett és a tárolt dokumentumok különbsége (unaccounted), és az emberi figyelmet igénylő tételek. Köteg id vagy a ZIP sha256 alapján.',
    { batch_id_or_sha256: z.string() },
    async ({ batch_id_or_sha256 }) => {
      try {
        const s = await getBatchStatus(batch_id_or_sha256)
        return s ? text(s) : text({ status: 'failed', error: 'Nincs ilyen köteg.' }, true)
      } catch (e) { return fail('A státusz lekérdezése nem sikerült', e) }
    },
  )

  server.tool(
    'list_import_errors',
    'Azok a dokumentumok, amelyeknél hiba-súlyú jelzés van (pl. nettó + ÁFA ≠ bruttó, hiányzó pénznem, szerverhiba). Ezek javítás nélkül nem hagyhatók jóvá. Köteg szerint szűrhető.',
    { batch_id: z.string().optional() },
    async ({ batch_id }) => {
      try { return text(await listImportErrors(batch_id)) } catch (e) { return fail('A listázás nem sikerült', e) }
    },
  )
}
