# Pénzügyi és számlafeldolgozás — megvalósítási terv (0–2. fázis)

Állapot: terv, kód még nem készült. Szerzők: Laci, Arthur (ChatGPT), Claude.
Hatókör: **csak a 0–2. fázis.** A bank, a riportok és az éles CRM-számlázás külön, későbbi kör.

## Megegyezett döntések

| Téma | Döntés |
|---|---|
| Az eredeti PDF | Az eredeti dokumentum a hiteles. Soha nem módosul; eltérésnél külön egyeztetési folyamat fut, az eredeti érintetlen marad. |
| Szabályok kikényszerítése | A szerver kényszeríti ki (jogosultság, összeg-ellenőrzés, véglegesítés). A modell javasol és feldolgoz, de nem kerülheti meg. |
| Float | **A meglévő táblákat NEM alakítjuk át** (Laci döntése: nincs adatvesztési kockázat). Az új pénzügyi táblák egész centet használnak; a régi `Float` mezőknél összehasonlításkor centre kerekítünk. Lásd „Pénz". |
| Kimenő és bejövő számla | **Egy közös adatmodell és import** — bejövő és kimenő is az első körben (Arthur kérése, elfogadva). |
| Feltöltési útvonal | Nem döntjük el előre. **Mindkettőt kipróbáljuk:** (A) ZIP közvetlenül a ChatGPT-be, a modell strukturáltan adja át; (B) feltöltés a CRM weboldalára. A (B) alternatíva, nem alapértelmezett. Az eredeti fájl megőrzéséhez mindkét esetben kell fájlátadási út. |
| Siker mértéke | Nem „x% automatikus". Mérjük: (1) a feltöltött dokumentumok 100%-áról van elszámolás (feldolgozva / duplikátum / ellenőrzésre vár / hibás); (2) az egyértelmű tételek automatikusan mennek; (3) bizonytalan adatból nem keletkezik észrevétlenül hibás rekord. |
| Ellenőrzési sor | Tesztidőszakban minden import ellenőrzésre vár. Később, bizonyított megbízhatóság után az alacsony kockázatú tételek automatikusan is rögzíthetők lesznek. A hivatalos számla véglegesítése mindig külön jogosultság. |
| Tesztelés | Migrációt és feltöltési kísérletet **előbb tesztkörnyezetben**, nem éles adaton. |

## Séma-biztonság (tájékoztató)

A `vercel.json` build-parancsa minden buildnél lefuttatja a `prisma db push`-t, a `DIRECT_URL` pedig preview és production közös. Ezért egy PR előnézeti buildje is módosíthatja az éles sémát.
Laci döntése: külön tesztkörnyezet nem kell, a CRM tesztfázisban van (várhatóan 2027-ig, párhuzamos munkával), az éles átállás később, ellenőrzés után jön.
**Szabály marad:** csak additív séma-változtatás (új tábla, új nullable oszlop). Nincs típusváltás, átnevezés, törlés — a `db push` a típusváltást adatvesztés-gyanúsnak jelöli, és megállítaná a deployt.

## Pénz (0. fázis)

- A meglévő `Float` mezőkhöz (Invoice, Expense, Order, Quote stb.) **nem nyúlunk.**
- Az új pénzügyi táblákban minden összeg **egész cent** (`Int`/`BigInt`), a pénznem külön mező.
- Régi és új adat összevetésekor mindig centre kerekítünk (`Math.round(x * 100)`), egy közös segédfüggvénnyel.
- Ahol az import a meglévő `Expense`/`Invoice` táblába is ír (kompatibilitás miatt), az érték `cent / 100`.
- Ha később kell az átállás, az árnyék-oszlopos módszer (új centes oszlop a régi mellett, visszatöltés, 0 eltérés ellenőrzése) külön körben elérhető.

## 0. fázis további elemei
- **Actor-modell (későbbre):** külön kulcs és név ügynökönként. Most csak Arthur van; a pénzügyi rekordokba a szerző neve (Arthur / webes felhasználó) bekerül. A Gabi-féle GPT bekötésekor jön a teljes modell. A meglévő `MCP_SECRET` változatlanul „Arthur"-ként működik.
- **Pénzügyi szabályok a szerveren:** nettó + ÁFA = bruttó ellenőrzés, véglegesítés külön jogosultság.

## Állapot

| Szelet | Állapot |
|---|---|
| Új táblák (ImportBatch, FinancialDocument, FinancialDocumentEvent) | kész |
| Pénz-kerekítés, összeg-ellenőrzés, duplikáció-osztályozás | kész, tesztelt |
| Szolgáltatás (`src/lib/finance/documents.ts`) és MCP-eszközök | kész, tesztelt |
| Webes jóváhagyási felület (ellenőrzési sor) | **következik** |
| Anyagiasítás: jóváhagyott tételből Expense / Invoice rekord | következik |
| Az eredeti fájl tárolása (Vercel Blob) és szerver-oldali hash-ellenőrzés | következik; addig a hash a hívó állítása, ezt a válasz `originalFileStored: false` mutatja |

MCP-eszközök: `import_financial_batch`, `get_financial_document`, `list_financial_documents`, `get_import_status`, `list_import_errors`.
A jóváhagyás szándékosan **nincs** MCP-n: az ügynök a saját importját nem hagyhatja jóvá.

Tesztek: `npm test` (tiszta logika, mindig fut) és `npm run test:db` (valódi adatbázison, csak helyi DB-n: `FINANCE_TEST_DATABASE_URL=postgresql://…@localhost:5432/…`; éles adatbázison megtagadja a futást).

## 1. fázis — feltöltési kísérlet
A két útvonal (A és B) valódi kipróbálása, **Laci végzi ChatGPT-ből**, mert a ChatGPT oldali viselkedést innen nem tudom tesztelni. Eredmény: melyik fájlátadás működik ténylegesen, mekkora méretig, és hova kerül az eredeti fájl.
Technikai korlát, amivel számolni kell: a Vercel függvény kérés-mérete és futásideje korlátos, nagyobb ZIP-hez közvetlen Blob-feltöltés és aszinkron feldolgozás kell.

## 2. fázis — közös számlaimport
Eredeti bizonylat → adatkinyerés → ellenőrzés → rögzítés.
- Dokumentumtár: eredeti fájlnév, SHA-256, import ideje és forrása, státusz; az eredeti változatlan.
- Idempotens import (ugyanaz a ZIP kétszer nem hoz létre új tételt), újraindítható.
- Duplikációvédelem több jel alapján, nem csak a számlaszámból. Bizonytalan egyezésnél nincs automatikus összevonás.
- A meglévő CRM-tesztszámokat **nem írjuk felül**; külön „eredeti számlaszám" mező, egyeztetés.
- MCP-műveletek kötegelten, géppel feldolgozható eredménnyel (létrehozva / módosítva / kihagyva / hiba / emberi döntésre vár).

## 3. fázis (a 2. után)
Az augusztusi könyvelői ZIP teljes feldolgozása elkülönített környezetben, tételes összevetéssel.

## Nyitott kérdések
1. Az augusztusi ZIP-ből elég néhány minta (2–3 kimenő, 2–3 bejövő PDF); bankkivonat most nem kell.
2. Gabi GPT-jének profilja — később, a bekötéskor.
