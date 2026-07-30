# Árajánlat (Angebot) az MCP-n — mit nem lát és mit nem tud szerkeszteni az ügynök

Állapotfelmérés dátuma: 2026-07-30
Vizsgált MCP szerver: `src/app/api/mcp/route.ts` (`memini-crm` v1.7.0, 95 tool)

## A rövid válasz

Az ügynök következtetése helyes volt, a *magyarázata* viszont nem.

Nem arról van szó, hogy „a Memini CRM nem tud árajánlatot”. A CRM **teljesen tud**
árajánlatot: van adatbázis-modell, van REST API, van működő felület, van
`AJ-2026-001` formátumú ajánlatszám-generálás. Egyetlen dolog hiányzik: **az MCP
szerver egyetlen tool-t sem tesz közzé az árajánlatokhoz.** Az ügynök tehát nem
egy nem létező funkciót keresett, hanem egy létező funkciót, amihez nincs
bekötve a csatlakozó.

Amit az ügynök jól döntött: helyesen tagadta meg, hogy számlatervezetet
állítson ki „árajánlat helyett”. Az valóban könyvelési objektum lenne, és a
`Quote` modell külön létezik pontosan ezért.

## Ami a CRM-ben megvan (de az ügynök nem éri el)

| Szint | Állapot |
|---|---|
| Adatbázis | `model Quote` + `model QuoteItem` (`prisma/schema.prisma:427`) |
| REST — lista, létrehozás | `GET`, `POST /api/quotes` |
| REST — egy ajánlat | `GET`, `PUT`, `DELETE /api/quotes/[id]` |
| Felület | `/quotes` — létrehozás tételekkel, státuszváltás, törlés |
| Ajánlatszám | automatikus, `AJ-<év>-<3 jegy>` |
| MCP | **nincs egyetlen tool sem** |

A `Quote` mezői, amiket az ügynök ma nem tud sem olvasni, sem írni:
`number`, `date`, `validUntil`, `status` (alap: `draft`), `notes`, `contactId`,
`companyId`, `items[]` (`description`, `quantity`, `unitPrice`, `vatRate` — alap 19,
`productId`), `subtotal`, `vatAmount`, `total`, `currency` (alap `EUR`).

Az összegeket a REST végpont maga számolja a tételekből, tehát az ügynöknek
nem kell (és nem is szabad) `subtotal`/`vatAmount`/`total` értéket küldenie.

## A hiány pontosan

**1. Nincs árajánlat-tool az MCP-n.** A 95 tool között van `create_invoice`,
`create_order`, `create_delivery_note`-hoz státuszkezelés, `list_products`,
`get_pricelist`, `list_companies`, `list_contacts` — de `list_quotes`,
`get_quote`, `create_quote`, `update_quote`, `update_quote_status` nincs.
Az ügynök tehát az árajánlatokat **nem látja** (nem tudja megmondani, hogy egy
partnernek adtunk-e már ajánlatot, és mit), és **nem tudja szerkeszteni**
(se létrehozni, se státuszt váltani, se lejáratot beírni).

**2. Az ajánlat → megrendelés lánc is szakadt.** Az `Order` modellnek van
`quoteId` mezője, és a `POST /api/orders` el is fogadja. Az MCP `create_order`
tool viszont nem kéri és nem adja át, tehát az ügynök által létrehozott
megrendelés soha nem tud visszamutatni az ajánlatra.

**3. Nincs nyomtatási nézet az ajánlathoz.** A számláknak és a
megrendeléseknek van `[id]/print` oldala, az árajánlatnak nincs — sőt egyedi
ajánlat-oldal (`/quotes/[id]`) sincs, csak a listaoldal. Vagyis a
„CRM-ből kinyomtatott / PDF-be mentett ajánlat” ma nem létezik; ha az ügynök
PDF-et gyárt, az a CRM-en kívüli dokumentum, nem az `AJ-2026-...` rekord képe.

**4. Mellékes lelet:** a `create_delivery_note` is hiányzik az élő MCP-ből
(csak `list` / `get` / `update_status` van), pedig a régi
stdio szerverben (`mcp/server.ts`) még megvolt. Nem az ajánlat-probléma része,
de ugyanaz a mintázat: a régi és az élő MCP eltért egymástól.

## Prompt az ügynöknek — „mondd meg tisztán, mit látsz”

Ezt bemásolhatod az ügynöknek, ha azt akarod, hogy pontosan fogalmazzon
ahelyett, hogy a CRM-re hárítja:

> Az árajánlatokkal kapcsolatban ne a CRM képességeiről beszélj, hanem arról,
> hogy neked mi van bekötve. Válaszolj konkrétan:
>
> 1. Listázd a nálad elérhető MCP tool-ok közül azokat, amelyek árajánlatot
>    (Quote / Angebot) olvasnak vagy írnak. Ha nincs ilyen, mondd ki: „nulla”.
> 2. Mondd meg, hogy ez azt jelenti-e, hogy a CRM nem tud árajánlatot, vagy
>    csak azt, hogy te nem érsz hozzá. Ne mosd össze a kettőt.
> 3. Sorold fel, mit tudsz és mit nem: látod-e egy partner korábbi ajánlatait,
>    tudsz-e új ajánlatot létrehozni, tudsz-e státuszt (draft/sent/accepted)
>    váltani, tudsz-e érvényességi határidőt beírni, tudsz-e ajánlatból
>    megrendelést csinálni úgy, hogy a kettő össze legyen kapcsolva.
> 4. Ha ajánlatot kérnek tőled, soha ne állíts ki helyette számlatervezetet
>    vagy megrendelést. Írd meg az ajánlat tartalmát szövegben, és jelezd, hogy
>    a CRM-es rekord létrehozásához hiányzik a tool.

## Prompt a fejlesztéshez — „kösd be”

> A Memini CRM MCP szerverében (`src/app/api/mcp/route.ts`) nincs egyetlen
> árajánlat-tool sem, pedig a `Quote` / `QuoteItem` modell, a `/api/quotes` és
> `/api/quotes/[id]` végpontok, valamint a `/quotes` felület már működnek.
> Vedd fel a következő tool-okat, a fájlban használt mintát követve (közvetlen
> Prisma-hívás, zod séma, magyar leírás), a `create_invoice` / `create_order`
> tool-ok szerkezetét másolva:
>
> - `list_quotes` — szűrés `companyId`, `contactId`, `status` szerint; tételek
>   és partner beágyazva.
> - `get_quote` — egy ajánlat teljes adata azonosító alapján.
> - `create_quote` — `companyId`, `contactId`, `date`, `validUntil`, `notes`,
>   `items[{ description, quantity, unitPrice, vatRate = 19, productId }]`.
>   Az ajánlatszámot a szerver generálja (`AJ-<év>-<NNN>`), az összegeket a
>   tételekből számolja; a hívó ne adhasson meg `subtotal` / `total` értéket.
> - `update_quote` — ugyanazok a mezők, plusz `id`. Vigyázz: a REST `PUT` a
>   tételeket törli és újra létrehozza, tehát a részleges tétel-frissítés
>   csendben adatot veszít; vagy add át a teljes tétellistát, vagy a tool
>   dokumentálja ezt.
> - `update_quote_status` — pontosan ez az öt érték, mert a `/quotes` oldal
>   `QUOTE_STATUS` térképe is ezeket használja: `draft` (Tervezet), `sent`
>   (Kiküldve), `accepted` (Elfogadva), `rejected` (Elutasítva), `expired`
>   (Lejárt).
> - `convert_quote_to_order` — az ajánlat tételeiből megrendelés, és az
>   `Order.quoteId` beállítása. Ehhez az MCP `create_order` tool-ját is
>   bővítsd egy opcionális `quoteId` paraméterrel (a REST végpont már kezeli).
>
> Emeld az `McpServer` verziót, és a tool-leírásokban mondd ki, hogy az
> árajánlat **nem** könyvelési objektum — számlatervezetet nem szabad
> árajánlat helyett kiállítani.
>
> Külön, opcionális darab: `/quotes/[id]` és `/quotes/[id]/print` oldal a
> számlák és megrendelések nyomtatási nézetének mintájára, hogy az ajánlatnak
> is legyen hivatalos, nyomtatható képe.
