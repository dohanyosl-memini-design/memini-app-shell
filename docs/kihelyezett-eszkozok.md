# Kihelyezett eszközök: kellék-nyilvántartás, szerződés és a jogosultsági határ

**Állapot:** terv (kód még nincs belőle)
**Készült:** 2026-09-03

---

## 1. Miért kell ez

A Memini rendszeresen ad ki partnereknek **fizikai kellékeket**: hűtőmágnestartó
állványokat, karusszeleket, tolltartókat és a hozzájuk tartozó alkatrészeket
(felső tábla, gyűrűk, alsó kosár). Ma ez a nyilvántartás:

| Hol van most | Mi a baj vele |
|---|---|
| Egy Excel-táblában | Nincs összekötve a partnerrel, senki nem frissíti következetesen. |
| Részben fejben | Nem kereshető, nem átadható, elvész. |
| Szerződések egy mappában | Megvan a papír, de nem tudni, melyik él, és mi van még kint. |

Ebből három konkrét gond következik:

1. **Nem tudjuk, kinél mi van.** Egy partner felhívásakor nincs egy hely, ahol
   ez egy pillantással látszana.
2. **Nem tudjuk, mi hiányzik.** Ha egy karusszel visszajön két gyűrű nélkül, az
   sehol nem csapódik le — se darabban, se euróban.
3. **A szerződés és a valóság elcsúszik.** Elvileg mindenről van szerződés, de
   nincs összekötve azzal, ami ténylegesen kint van.

> A kihelyezett kellék **vagyontárgy**. Ha nem tudjuk, hol van, az nem
> adminisztrációs kényelmetlenség, hanem elveszett pénz.

---

## 2. Az alapszabályok, amikből minden más következik

Négy szabály, ami az egész funkció viselkedését meghatározza:

> **1. A fizikai tényt ember rögzíti. Az AI előkészít, az ember zár.**
> Az átadás és a visszavétel a valóságban történik, nem az adatbázisban. Arthur
> előkészítheti mindkettőt, de „megtörtént"-té csak bejelentkezett ember teszi.

> **2. Az aláírt szerződés zárolt pillanatkép.**
> Ami egyszer kiment a partnerhez, azt utólag nem írjuk át. Változás esetén új
> átadás vagy kiegészítés készül — a régi megmarad úgy, ahogy aláírták.

> **3. A katalógus módosítása nem írja át a múltat.**
> Ha a Beállításokban átnevezel vagy kivezetsz egy kelléket, a korábbi
> kihelyezések és szerződések változatlanok maradnak.

> **4. Kint lévő eszközzel partnert nem lehet csendben archiválni.**
> A temetőbe rakás nem tüntetheti el azt, hogy fizikailag még nálunk van kint
> két állvány.

---

## 3. A fogalmak

Négy fogalom, ami a modell egészét adja:

| Fogalom | Mit jelent | Példa |
|---|---|---|
| **Kellék** (`AssetType`) | Egy kiadható eszközfajta a katalógusban | „Nagy álló karusszel" |
| **Alkatrész** (`AssetComponent`) | Egy kellékhez tartozó rész, felsorolás + kép | „Felső tábla", „Gyűrűk", „Alsó kosár" |
| **Átadás** (`AssetPlacement`) | Egy átadási esemény egy partnernél | „2026-09-10, Dóm shop, karusszel + tartozékok" |
| **Tétel** (`AssetPlacementItem`) | Egy sor az átadásban: kellék vagy alkatrész, darabbal | „Gyűrűk — 12 db" |

A katalógus (kellék + alkatrész) a **Beállításokban** él, és bármikor bővíthető
kód nélkül. Az átadás a **partner oldalán** él.

### 3.1 Miért kell a tétel-szint

Mert a te folyamatod alkatrész-szintű: *„karusszel ✓, felső tábla ✓, alsó kosarat
nem adtunk → az nem kerül bele a szerződésbe."* És mert a visszavételnél is ez a
kérdés: *nem az számít, visszajött-e „a karusszel", hanem hogy hány gyűrű jött
vissza belőle.* Egy kellék-szintű pipa ezt nem tudja kifejezni.

Ezért a tételek **önhivatkozó fát** alkotnak (ahogy a `Goal` és a `MarketingArc`
is): a kellék-sor a szülő, az alkatrész-sorok a gyerekei. Egy átadásban több
kellék is lehet, mindegyik a saját kipipált alkatrészeivel.

---

## 4. Az életút és az állapotok

```
   [ Arthur vagy ember előkészíti ]
                 │
                 ▼
            piszkozat  ────────────────► elvetve
           (draft)                       (discarded)
                 │
      EMBER megerősíti az átadást
                 │
                 ▼
              kint  ◄──────────┐
              (out)            │ (részleges visszavétel után
                 │             │  marad kint a többi)
      EMBER visszavételez      │
                 │─────────────┘
                 ▼
    ┌────────────┴────────────┐
    ▼                         ▼
 visszavéve            hiánnyal lezárva
 (returned)            (closed_with_loss)
```

| Állapot | Mit jelent | Beleszámít a „kint van" készletbe? |
|---|---|---|
| `draft` | Előkészítve, fizikailag még nem adtuk át | **Nem** |
| `out` | Ember megerősítette: átadva, kint van | Igen |
| `partially_returned` | Egy része visszajött, más része kint | Igen (a maradék) |
| `returned` | Minden visszajött hiánytalanul | Nem |
| `closed_with_loss` | Lezárva, de tétel hiányzik (érték kiesett) | Nem |
| `discarded` | Piszkozat elvetve | Nem |

**Fontos:** a `draft` **nem számít** kihelyezésnek. Ez a védelem lényege — amit
Arthur létrehoz, az addig nem szennyezi a nyilvántartást, amíg ember rá nem
bólint. A `partially_returned` / `returned` / `closed_with_loss` állapot a
**tételekből számítódik** minden visszavételi művelet után, nem kézzel állítjuk.

---

## 5. Az adatmodell

Vázlat, nem végleges séma — a mezőnevek a megvalósításkor pontosodnak.

### 5.1 `AssetType` — a kellék (katalógus)

| Mező | Típus | Megjegyzés |
|---|---|---|
| `name` / `nameDE` | String | Magyar és német név (a szerződés németül megy) |
| `category` | String? | állvány / karusszel / tolltartó / egyéb |
| `defaultValue` | Float | Alapérték €-ban — a szerződéshez és a kárszámításhoz |
| `imageUrl` | String? | Vercel Blob, a meglévő képkezelés szerint |
| `contractAddendumDe` | Text? | **Kellékspecifikus szerződés-kiegészítés** (német) |
| `active` | Boolean | **Soft-delete** — kivezetett kellék nem törlődik |
| `sortOrder` | Int | |

### 5.2 `AssetComponent` — az alkatrész

| Mező | Típus | Megjegyzés |
|---|---|---|
| `assetTypeId` | FK | Melyik kellékhez tartozik |
| `name` / `nameDE` | String | |
| `imageUrl` | String? | A felsoroláshoz tartozó kép |
| `defaultValue` | Float | Alkatrész-érték €-ban (a hiány számításához) |
| `defaultQuantity` | Int? | Alapértelmezett darab (pl. gyűrűk: 12) |
| `active` | Boolean | **Soft-delete** |
| `sortOrder` | Int | |

### 5.3 `AssetPlacement` — az átadás

| Mező | Típus | Megjegyzés |
|---|---|---|
| `companyId` | FK | A partner (a `Company`-n, nem a `Contact`-on — ahogy az életciklus is) |
| `contactId` | FK? | Opcionális: kinek a kezébe adtuk |
| `status` | String | `draft` / `out` / `partially_returned` / `returned` / `closed_with_loss` / `discarded` |
| `source` | String | `human` / `agent` / `migration` — ki hozta létre |
| `issuedAt` | DateTime? | **Az átadás napja** (csak megerősítéskor íródik) |
| `issuedById` | FK User? | **Ki adta ki** — a megerősítő ember, sosem Arthur |
| `confirmedAt` | DateTime? | Mikor lett a piszkozatból „kint" |
| `closedAt` | DateTime? | Mikor zárult le (vissza vagy hiánnyal) |
| `closedById` | FK User? | Ki zárta le |
| `notes` | String? | |
| `amendmentOfId` | FK self? | Ha egy korábbi átadás kiegészítése |

### 5.4 `AssetPlacementItem` — a tétel

| Mező | Típus | Megjegyzés |
|---|---|---|
| `placementId` | FK | |
| `parentItemId` | FK self? | Alkatrész-sor esetén a kellék-sorra mutat |
| `assetTypeId` / `componentId` | FK? | A kettő közül az egyik van kitöltve |
| `nameSnapshot` | String | **Név-pillanatkép** kiadáskor (3. alapszabály) |
| `unitValueSnapshot` | Float | **Érték-pillanatkép** kiadáskor |
| `quantity` | Int | Hány darabot adtunk ki |
| `returnedQty` | Int | Hány jött vissza |
| `lostQty` | Int | Hány hiányzik (ebből jön a pénzben kifejezett veszteség) |
| `returnedAt` | DateTime? | |

A `lostQty * unitValueSnapshot` összege adja a **kiesett értéket** — ez az a szám,
ami miatt az egész funkció készül.

### 5.5 `AssetEvent` — a napló (append-only)

A `TaskEvent` / `ContentEvent` mintájára, ugyanazzal a logikával: `actor`,
`action`, `field`, `before`, `after`, `createdAt`.

Rögzített műveletek: `created`, `updated`, `handover_confirmed`,
`contract_generated`, `contract_sent`, `contract_signed`, `returned`,
`marked_lost`, `discarded`.

> Ez a napló válaszolja meg örökre a *„ki adta ki és mikor"* kérdést — Arthur
> műveletei is ide kerülnek, `actor: 'Arthur'` néven, tehát utólag mindig
> elkülöníthető, mit csinált a gép és mit az ember.

### 5.6 `AssetContractTemplate` — a szerződéssablon

Egy rekord (a `CommTemplate` mintájára, Beállításokból szerkeszthető):
`titleDe`, `bodyDe` (a fix német alapszöveg tokenekkel), `updatedAt`.

### 5.7 Szerződés-mezők az átadáson

| Mező | Megjegyzés |
|---|---|
| `contractNumber` | Sorszám, a `quotes` / `delivery-notes` számozás mintájára |
| `contractSnapshot` | **Json pillanatkép** a tételekről a generálás pillanatában |
| `contractStatus` | `none` / `generated` / `sent` / `signed` |
| `contractFileUrl` | A generált DOCX (Vercel Blob) |
| `signedFileUrl` | A visszakapott, aláírt példány (feltölthető) |
| `signedAt` | |

---

## 6. A szerződés

### 6.1 Hogyan áll össze

```
┌─────────────────────────────────────────┐
│  ALAPSZÖVEG (Beállítások, német, fix)   │  ← egyszer megírod
│  tokenekkel: {{Firmenname}}, {{PLZ}}…   │
├─────────────────────────────────────────┤
│  TÉTELTÁBLÁZAT                          │  ← csak a KIPIPÁLT tételek
│  karusszel 1 db … 240,00 €              │
│  ├ felső tábla 1 db … 40,00 €           │
│  └ gyűrűk 12 db … 60,00 €               │
│  (alsó kosár NINCS pipálva → nem szerepel) │
├─────────────────────────────────────────┤
│  KELLÉK-KIEGÉSZÍTÉSEK                   │  ← csak az érintett kellékeké
│  (AssetType.contractAddendumDe)         │
└─────────────────────────────────────────┘
```

### 6.2 A tokenek

`{{Firmenname}}`, `{{Adresse}}`, `{{PLZ}}`, `{{Ort}}`, `{{Land}}`,
`{{Ansprechpartner}}`, `{{USt_IdNr}}`, `{{Geräteliste}}`, `{{Gesamtwert}}`,
`{{Übergabedatum}}`, `{{Übergeben_durch}}`, `{{Vertragsnummer}}`.

A `{{Geräteliste}}` helyére generálódik a tételtáblázat, a `{{Gesamtwert}}`
helyére az érték-pillanatképek összege.

### 6.3 A zárolás szabálya

| Szerződés állapota | Módosítható-e a tétel-összetétel? |
|---|---|
| `none` / `generated` | Igen — újragenerálásnál új pillanatkép készül |
| `sent` / `signed` | **Nem.** Változás csak új átadással vagy kiegészítéssel (`amendmentOfId`) |

E nélkül a napló csak látszat-bizonyíték lenne: utólag átírható tételekkel egy
aláírt szerződés semmit nem igazol.

### 6.4 A kimenet

A meglévő számla/szállítólevél mintát követve:
- **DOCX** (`docx` csomag, ahogy az `/api/invoices/[id]/docx`),
- **nyomtatható oldal** (ahogy a `/invoices/[id]/print`).

Arthur mindkettőt elő tudja készíteni — neked már csak küldeni vagy nyomtatni kell.

---

## 7. A jogosultsági határ — a lényeg

### 7.1 A két kódút

Ezt fontos pontosan érteni, mert a védelem ezen áll:

| Út | Hitelesítés | Middleware | Mit ér el |
|---|---|---|---|
| **Webes felület** | NextAuth session (belépett ember) | Véd | Minden, amit a UI kínál |
| **Arthur (`/api/mcp`)** | `MCP_SECRET` kulcs | **Kihagyva** | Csak amit toolként kap |

Arthur tehát **nem** a session-védett REST-en jön be, hanem egy külön, session
nélküli végponton, közvetlenül a Prisma-hoz. Ebből két dolog következik:

1. **A védelem nem lehet „a session majd elutasítja".** Az `/api/mcp` úton nincs
   session, amit elutasítani lehetne. A határ csak az lehet, hogy **a képesség
   nem létezik Arthur felületén**.
2. **A `MCP_SECRET` mögött nincs személy.** Minden Arthur-művelet „Arthur" —
   nem „te" és nem „Gabi". Ezért **emberi identitáshoz kötött szabály kizárólag
   a session mögött érvényesíthető**, soha az MCP-kulcs mögött.

### 7.2 Mit kap Arthur és mit nem

**Megkapja (olvasás):**
- `list_asset_types`, `get_asset_type` — mi van a katalógusban
- `list_asset_placements` — kinél mi van (szűrve partnerre, státuszra)
- `get_asset_placement` — egy átadás részletei
- `get_company_assets` — egy partner teljes eszközképe

**Megkapja (írás, de csak piszkozat-szinten):**
- `create_asset_placement_draft` — **piszkozatot** hoz létre, nem kihelyezést
- `update_asset_placement_draft` — csak `draft` állapotú átadást módosíthat
- `prepare_asset_contract` — legenerálja a szerződést + nyomtatható változatot

**NEM kapja meg — nem is létezik toolként:**
- `confirm_asset_handover` — az átadás megerősítése (ember)
- `return_asset_items` — visszavételezés tétel-szinten (ember)
- `mark_asset_lost` — hiány rögzítése (ember)
- bármilyen `delete_asset_*`

**Két további, kódba égetett korlát:**
- Az Arthurnak adott író-toolok **a `status` mezőt nem fogadják el paraméterként**
  — tehát nem tud „szerkesztéssel" visszavételezni.
- Az `update_asset_placement_draft` **elutasítja a nem-`draft`** állapotú
  átadásokat — amit ember már megerősített, ahhoz Arthur nem nyúl.

A státusz-átmenetek egyetlen helyen élnek (`lib/assets.ts`), és az emberhez
kötött függvényeket az MCP-felület egyszerűen **nem importálja**. Így a határ nem
konvenció, hanem szerkezet.

### 7.3 Miért piszkozat az is, amit Arthur „kiad"

Arthur **beérkező partner-leveleket olvas**. A séma is rögzíti a szabályt: a
legrosszabb, amit egy rosszindulatú levél elérhet, legyen visszafordítható.

Ha Arthur azonnal „kint" státuszú kihelyezést tudna létrehozni, egy manipulált
vagy félreértett levél **fantom-kihelyezést** vagy **rossz partnernek szóló
szerződést** eredményezhetne — pont abban a nyilvántartásban, aminek az a
feladata, hogy megbízható legyen.

Ezért:

> Arthur mindent előkészíthet, de **semmit nem tesz ténnyé**. A piszkozat nem
> számít bele a készletbe, a szerződést nem küldi ki senki automatikusan, és a
> „ki adta ki" mezőbe a **megerősítő ember** kerül — mert fizikailag ő adta át.

Ugyanez a szimmetria indoka: ha a visszavétel azért emberi, mert fizikai és
pénzügyi tény, akkor a **kiadás ugyanennyire az**.

---

## 8. A három felület

### 8.1 Beállítások → új „Eszközök" fül

A meglévő `Beállítások` oldal fülszerkezetébe (`🔑 Fiók`, `✉️ Kommunikáció`)
kerül egy harmadik: **`📦 Eszközök`**, benne három szekció a
`TemplatesSection` / `MemoryTypesSection` mintájára:

1. **Kellékek** — új kellék felvitele (név HU/DE, kategória, érték, kép,
   szerződés-kiegészítés), szerkesztés, kivezetés (soft-delete).
2. **Alkatrészek** — a kiválasztott kellék alatt, képpel és alapdarabszámmal.
3. **Szerződéssablon** — a német alapszöveg szerkesztése, a használható tokenek
   listájával és egy „minta-előnézet" gombbal.

### 8.2 Partneroldal → új „Eszközök" fül

A cégoldal meglévő fülsorába (`timeline` … `invoices`) egy új fül. Tartalma:

- **Ami most kint van** — kellékenként, alkatrész-bontással, kiadás dátumával és
  a kiadó nevével.
- **Új átadás** — kellék választása, alkatrészek **kipipálása darabszámmal**,
  majd `Átadás megerősítése` (ez az emberi lépés).
- **Visszavétel** — tételenként „visszajött / hiányzik" darabszámmal; a rendszer
  kiszámolja a hiány értékét és lezárja az átadást.
- **Szerződés** — generálás, DOCX letöltés, nyomtatás, aláírt példány feltöltése.
- **Arthur piszkozatai** — külön, jól láthatóan elkülönítve, `Megerősítem` /
  `Elvetem` gombbal.
- **Előzmény** — a lezárt átadások és a napló.

### 8.3 Új `/eszkozok` oldal

Ez váltja ki az Excelt:

- Felül néhány szám: **hány db van kint**, **hány partnernél**, **kint lévő
  érték €-ban**, **eddig kiesett érték €-ban**.
- Táblázat: partner, kellék, darab, kiadás dátuma, kiadó, státusz, szerződés.
- Szűrők: partner, kellék, státusz, „csak hiányos", „csak szerződés nélküli".
- Külön kiemelve: **szerződés nélkül kint lévő eszközök** és **Arthur nyitott
  piszkozatai**.

---

## 9. Mit érint még a kódban

| Hely | Mi a teendő |
|---|---|
| **Partner-archiválás** | A `Company` archiválása előtt ellenőrzés: ha van `out` / `partially_returned` átadása, figyelmeztetés (4. alapszabály). |
| **Biztonsági mentés** | Az új táblák bekerülnek a `/api/backup` exportba és a napi cron-mentésbe — különben pont az új nyilvántartás maradna ki. |
| **Partner-idővonal** | Az átadás és a visszavétel jelenjen meg a cég `timeline` fülén, a többi esemény között. |
| **Arthur napi futásai** | A napi jelentés térjen ki a nyitott piszkozataira és a rég kint lévő, szerződés nélküli eszközökre. |
| **MCP tool-annotációk** | Az új toolok illeszkedjenek a meglévő `annotationsFor()` logikába (`list_`/`get_` = olvasó; a `create_`/`update_`/`prepare_` írók, de nem rombolók). |

---

## 10. A megvalósítás lépései

Négy kör, mindegyik önmagában is használható állapotot ad.

**1. kör — a nyilvántartás (a legnagyobb fájdalom megszűnik)**
1. Prisma-modellek + migráció (`AssetType`, `AssetComponent`, `AssetPlacement`,
   `AssetPlacementItem`, `AssetEvent`).
2. `lib/assets.ts` — státusz-átmenetek, érték- és hiányszámítás egy helyen.
3. Beállítások → `Eszközök` fül: kellékek és alkatrészek kezelése.
4. Partneroldal → `Eszközök` fül: átadás, megerősítés, visszavétel.
5. Napló + a partner-archiválás ellenőrzése.

**2. kör — a szerződés**
6. `AssetContractTemplate` + a sablonszerkesztő a Beállításokban.
7. Szerződésgenerálás: token-behelyettesítés, tételtáblázat, kiegészítések,
   pillanatkép, sorszám.
8. DOCX + nyomtatható oldal.
9. Zárolási szabály (`sent` / `signed` után nincs tétel-módosítás), aláírt
   példány feltöltése.

**3. kör — az áttekintés**
10. `/eszkozok` oldal a számokkal, szűrőkkel, kiemelésekkel.
11. Backup-kiterjesztés, idővonal-bejegyzések.

**4. kör — Arthur**
12. Olvasó toolok.
13. Piszkozat-létrehozás és -szerkesztés (státuszmező nélkül, csak `draft`-ra).
14. `prepare_asset_contract`.
15. A piszkozat-megerősítő felület véglegesítése + Arthur napi jelentésének
    kiegészítése.

**A meglévő Excel átvétele** a 1. kör után történik: a mai állapot kézzel vagy
egyszeri importtal kerül be, `source: 'migration'` jelöléssel. Ezek az átadások
szerződés nélkül és becsült dátummal indulnak — a `/eszkozok` oldal külön
kiemeli őket, hogy fokozatosan rendezhetők legyenek.

---

## 11. Amit ez a kör nem tartalmaz (rögzített hátralék)

- **Emlékeztető kint felejtett eszközre** — pl. ha X ideje visszavétel nélkül
  van kint, vagy a partner inaktívvá vált. Természetes folytatás, de előbb
  legyen adat, amire ránézhet.
- **QR-kód / címke a fizikai darabokon** — az egyedi, szériaszámos darabkövetés
  irányába vinne; most tudatosan darabszám-alapú a modell.
- **Automatikus e-mail-kiküldés a szerződéssel** — szándékosan marad ki: a
  küldés emberi döntés.
- **Bérleti díj / kaució elszámolása** — most az érték csak a kárszámításhoz kell.
- **Fotó az átadás-átvételről** — később hasznos bizonyíték lehet.

---

## 12. Feltételezések és nyitott kérdés

**Amivel dolgozom:**
- A követés **darabszám-alapú partnerenként**, nem egyedi szériaszámos.
- A szerződés **német** nyelvű, egyetlen szerkeszthető alapsablonnal.
- Egy szerződés **egy átadási eseményt** fed le, több kellékkel és a hozzájuk
  kipipált alkatrészekkel.
- Arthur mindent előkészíthet, de átadást megerősíteni és visszavételezni csak
  bejelentkezett ember tud.

**Ami még eldöntendő:**

> **Ki visszavételezhet?** Két lehetőség:
> **(a)** bármely bejelentkezett ember — a védelem lényege „AI nem, ember igen";
> **(b)** név szerint csak a megadott felhasználók (te + Gabi) — ehhez a `User`
> modell `role` mezőjére vagy egy külön jogosultsági jelzőre épülő ellenőrzés kell.
>
> A terv **(a)-val** készült, mert az egyszerűbb és a fő kockázatot (az AI
> önálló lezárását) már kizárja. A **(b)** bármikor ráépíthető anélkül, hogy a
> modell változna — egyetlen ellenőrzés kérdése a visszavételi útvonalon.
