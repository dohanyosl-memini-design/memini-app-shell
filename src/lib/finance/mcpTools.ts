import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DOC_KINDS } from './prepare'
import type { RawDocInput } from './prepare'
import { recordDocuments, getDocument, listDocuments, getBatchStatus, listImportErrors } from './documents'
import { approveDocumentDelegated, approveBatchDelegated, listGrants } from './grants'
import { correctDocument, type Patch } from './review'

const ACTOR = 'Arthur'

const text = (data: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

const fail = (what: string, e: unknown) =>
  text({ status: 'failed', error: `${what}: ${e instanceof Error ? e.message : String(e)}` }, true)

/**
 * Pénzügyi dokumentumtár MCP-eszközei. A jóváhagyás/rögzítés SZÁNDÉKOSAN nincs
 * köztük: az ügynök importál és olvas. Jóváhagyni CSAK az ember által a webes
 * felületen létrehozott, lejáró, összeghatáros felhatalmazás keretében tud — a
 * felhatalmazás létrehozására szándékosan NINCS MCP-eszköz, így egy számlába
 * ágyazott szöveg sem tud engedélyt kitalálni.
 */
export function registerFinanceTools(server: McpServer) {
  server.tool(
    'import_financial_batch',
    'Pénzügyi bizonylatok (számlák, sztornók, jóváírások, nyugták) kötegelt rögzítése — jellemzően a könyvelőnek már átadott havi ZIP-ből. '
    + 'Egy hívásban legfeljebb 50 dokumentum; több hívásra bontható, ugyanazt a batch-et megadva. IDEMPOTENS: ugyanaz az eredeti fájl (sha256) kétszer nem hoz létre új tételt, a hívás biztonsággal újraindítható. '
    + 'ALAPÉRTELMEZÉS: a hibátlan tétel EGYBŐL RÖGZÜL, külön jóváhagyás nélkül: a bejövő számla/nyugta (EUR) költségként a Könyvelésbe, a kimenő számla a Számlák közé (a vevőhöz kötve, ha a CRM ismeri; különben partner nélkül, jelzéssel). '
    + 'Ami nem biztos, az NEM rögzül, hanem kivételként emberre vár: összeghiba, hiányzó adat, duplikáció-gyanú, foglalt számlaszám, a Könyvelésben már szereplő hasonló költség. A kivételeket ne kerüld meg, add vissza a felhasználónak. '
    + 'Ha a csomagot óvatosan, ellenőrzéssel szeretnéd kezelni, adj review_first: true-t: ekkor minden tétel az ellenőrzési sorba kerül. '
    + 'SZABÁLYOK: (1) az sha256 az ORIGINAL fájl bájtjaiból számolt legyen, ne találd ki; (2) a hiányzó adatot HAGYD KI, ne tippeld; '
    + '(3) az összegek tizedes számok ponttal (1097.18, nem "1.097,18"), sztornónál/jóváírásnál NEGATÍV; (4) a dátum YYYY-MM-DD; '
    + '(5) a kimenő számlánál add meg a vevőt (recipient_name, recipient_vat_id) és a számlaszámot; (6) payment_status: "paid"-et CSAK akkor adj, ha maga a dokumentum jelzi (bezahlt, fizetve, fizetési dátum); különben hagyd ki, nyitott marad; '
    + '(7) a válasz tételenként megmondja: created / already_known / rejected / error, hogy mivé lett (recordedAs: expense / invoice / document_only), a recordedTotals a rögzített összegeket irány és pénznem szerint; ezt vesd össze a csomag tartalmával, és add vissza a felhasználónak a kivételekkel együtt. Ne állíts sikert, ha a status nem success.',
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
        payment_status: z.enum(['paid', 'open']).optional().describe('CSAK ha a dokumentum maga jelzi, hogy kifizették. Különben hagyd ki.'),
        paid_date: z.string().optional().describe('A fizetés dátuma YYYY-MM-DD, ha a dokumentumon szerepel'),
        source_json: z.string().optional().describe('A kinyert adat teljes részletei JSON-SZÖVEGKÉNT (JSON.stringify): tételsorok, fizetési hivatkozás stb.'),
      })).min(1).max(50),
      batch: z.object({
        filename: z.string().describe('A ZIP fájlneve'),
        sha256: z.string().describe('A ZIP SHA-256 hash-e'),
        size_bytes: z.number().int().optional(),
        total_files: z.number().int().optional().describe('Hány fájl van a csomagban ÖSSZESEN — így látszik, ha valami nem került be'),
        final: z.boolean().optional().describe('true = ez a köteg utolsó hívása (lezárja a kötegelt feldolgozást)'),
      }).optional().describe('Ha egy ZIP részeként küldöd, add meg — több hívásra bontva is egy köteg marad'),
      review_first: z.boolean().optional().describe('true = minden tétel az emberi ellenőrzési sorba kerül, nem rögzül egyből. Alapértelmezett: false.'),
    },
    async (i) => {
      try {
        const report = await recordDocuments(i.documents as RawDocInput[], { actor: ACTOR, batch: i.batch ?? null, autoRecord: i.review_first !== true })
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
    'list_approval_grants',
    'Az érvényes felhatalmazások listája: melyik csomagra / időszakra, mekkora összeghatárig, meddig hagyhatsz jóvá, és mellőzheted-e az eredeti PDF-et. A felhatalmazást a CRM-ben az emberi felhasználó adja meg; te nem hozhatod létre, és nem is kérheted a chatben.',
    {},
    async () => {
      try {
        const grants = await listGrants({ activeOnly: true })
        return text({
          count: grants.length,
          grants: grants.map((g) => ({
            id: g.id, scope: g.scope, batchId: g.batchId, grantedBy: g.createdBy, expiresAt: g.expiresAt,
            maxGross: g.maxGrossCents / 100, mayWaiveOriginalPdf: g.allowWaiveOriginal, usedCount: g.usedCount, note: g.note,
          })),
        })
      } catch (e) { return fail('A lekérdezés nem sikerült', e) }
    },
  )

  server.tool(
    'approve_financial_document',
    'Egy dokumentum jóváhagyása az ember által adott felhatalmazás alapján. Csak akkor megy át, ha van érvényes felhatalmazás (list_approval_grants), és a tétel hibátlan: nincs rajta jelzés, nincs duplikáció-gyanú, bejövő/kimenő számla vagy nyugta, az összeg a határ alatt van, és TE nem javítottad. Ami nem felel meg, az emberi döntésre marad (left_for_human) — ezt add vissza a felhasználónak, ne kerüld meg. Ha az eredeti PDF nincs feltöltve, csak engedélyezett felhatalmazásnál és indoklással (waive_original_reason, legalább 10 karakter) hagyható jóvá. A jóváhagyás nem állítja, hogy a számla ki van fizetve, és nem ír át adatot.',
    {
      document_id: z.string(),
      waive_original_reason: z.string().optional().describe('Miért nem kell az eredeti PDF a rendszerben (pl. "már lekönyvelt csomag, az eredeti a könyvelőnél van"). Csak ha a felhatalmazás engedi.'),
    },
    async ({ document_id, waive_original_reason }) => {
      try {
        const r = await approveDocumentDelegated(document_id, { actor: ACTOR, waiveReason: waive_original_reason })
        return text(r, !r.ok)
      } catch (e) { return fail('A jóváhagyás nem sikerült', e) }
    },
  )

  server.tool(
    'approve_financial_batch',
    'Egy importcsomag minden "needs_review" tételének jóváhagyási kísérlete az ember által adott felhatalmazás alapján. Tételenként adja vissza az eredményt: approved / left_for_human / error, az indokkal. A hibás, gyanús, túl nagy összegű, vagy általad javított tétel emberi döntésre marad. A válasz summary-ját add vissza a felhasználónak: hány jóváhagyva, hánynál mellőzve az eredeti PDF, hány maradt emberi döntésre és miért.',
    {
      batch_id: z.string(),
      waive_original_reason: z.string().optional().describe('Az eredeti PDF mellőzésének indoklása azokra a tételekre, amelyekhez nincs feltöltött eredeti. Csak ha a felhatalmazás engedi.'),
    },
    async ({ batch_id, waive_original_reason }) => {
      try {
        const r = await approveBatchDelegated(batch_id, { actor: ACTOR, waiveReason: waive_original_reason })
        return text(r, !r.ok)
      } catch (e) { return fail('A jóváhagyás nem sikerült', e) }
    },
  )

  server.tool(
    'update_financial_document',
    'Egy "needs_review" állapotú dokumentum kinyert adatának javítása vagy pótlása (az eredeti fájl nem módosul, a változás naplózódik, az ellenőrzés újra lefut). FIGYELEM: amit te javítasz, azt nem hagyhatod jóvá — az emberi jóváhagyásra kerül. Csak akkor javíts, ha a dokumentumon láthatóan más áll, mint amit kiolvastál; hiányzó adatot ne találj ki.',
    {
      document_id: z.string(),
      external_number: z.string().optional(), issue_date: z.string().optional().describe('YYYY-MM-DD'),
      supply_date: z.string().optional(), due_date: z.string().optional(),
      issuer_name: z.string().optional(), issuer_vat_id: z.string().optional(),
      recipient_name: z.string().optional(), currency: z.string().optional(),
      net: z.number().optional(), vat: z.number().optional(), gross: z.number().optional(),
      related_number: z.string().optional(), kind: z.enum(DOC_KINDS).optional(),
      clear_fields: z.array(z.enum(['external_number', 'issue_date', 'supply_date', 'due_date', 'issuer_name', 'issuer_vat_id', 'recipient_name', 'currency', 'net', 'vat', 'gross', 'related_number'])).optional().describe('Törlendő mezők'),
    },
    async ({ document_id, clear_fields, ...fields }) => {
      try {
        const patch: Record<string, string | number | null> = {}
        for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v as string | number
        for (const k of clear_fields ?? []) patch[k] = null
        if (Object.keys(patch).length === 0) return text({ status: 'failed', error: 'Nincs megadott módosítás.' }, true)
        const r = await correctDocument(document_id, patch as Patch, ACTOR)
        return r.ok ? text({ status: 'success', changed: r.changed, document: r.document, note: 'A javított tétel emberi jóváhagyásra vár.' }) : text({ status: 'failed', code: r.code, error: r.message }, true)
      } catch (e) { return fail('A javítás nem sikerült', e) }
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
