# Pénzügyi és számlafeldolgozás — megvalósítási terv (0–2. fázis)

Állapot: terv, kód még nem készült. Szerzők: Laci, Arthur (ChatGPT), Claude.
Hatókör: **csak a 0–2. fázis.** A bank, a riportok és az éles CRM-számlázás külön, későbbi kör.

## Megegyezett döntések

| Téma | Döntés |
|---|---|
| Az eredeti PDF | Az eredeti dokumentum a hiteles. Soha nem módosul; eltérésnél külön egyeztetési folyamat fut, az eredeti érintetlen marad. |
| Szabályok kikényszerítése | A szerver kényszeríti ki (jogosultság, összeg-ellenőrzés, véglegesítés). A modell javasol és feldolgoz, de nem kerülheti meg. |
| Float | Pénzügyi adatnál nem megfelelő; egész centre állunk át. Lásd „Pénz-migráció". |
| Kimenő és bejövő számla | **Egy közös adatmodell és import** — bejövő és kimenő is az első körben (Arthur kérése, elfogadva). |
| Feltöltési útvonal | Nem döntjük el előre. **Mindkettőt kipróbáljuk:** (A) ZIP közvetlenül a ChatGPT-be, a modell strukturáltan adja át; (B) feltöltés a CRM weboldalára. A (B) alternatíva, nem alapértelmezett. Az eredeti fájl megőrzéséhez mindkét esetben kell fájlátadási út. |
| Siker mértéke | Nem „x% automatikus". Mérjük: (1) a feltöltött dokumentumok 100%-áról van elszámolás (feldolgozva / duplikátum / ellenőrzésre vár / hibás); (2) az egyértelmű tételek automatikusan mennek; (3) bizonytalan adatból nem keletkezik észrevétlenül hibás rekord. |
| Ellenőrzési sor | Tesztidőszakban minden import ellenőrzésre vár. Később, bizonyított megbízhatóság után az alacsony kockázatú tételek automatikusan is rögzíthetők lesznek. A hivatalos számla véglegesítése mindig külön jogosultság. |
| Tesztelés | Migrációt és feltöltési kísérletet **előbb tesztkörnyezetben**, nem éles adaton. |

## ⚠ Blokkoló felfedezés: nincs valódi tesztkörnyezet a sémához

A `vercel.json` build-parancsa **minden buildnél** lefuttatja a `prisma db push`-t, a séma pedig `directUrl = env("DIRECT_URL")`-t használ.
A Vercelben a `DIRECT_URL` **egyetlen változó, amely a `preview` és a `production` célra is érvényes**, ág-specifikus felülírás nélkül.
(A `DATABASE_URL`-nek van ág-szintű felülírása, a `DIRECT_URL`-nek nincs.)

Következmény: a séma-módosítást a Prisma CLI a közvetlen kapcsolaton keresztül hajtja végre, ezért **egy PR előnézeti buildje is az éles adatbázis sémáját módosíthatja még merge előtt.** Eddig csak hozzáadó változtatás volt, ami veszélytelen. Típusváltás vagy oszlop-törlés viszont az éles adaton futna le.

**Szabály, amíg ezt nem javítjuk:** csak additív séma-változtatás (új tábla, új nullable oszlop). Nincs típusváltás, átnevezés, törlés.

**Javítás (Laci teendője, Claude nem végzi el):** a fejlesztői ághoz külön Neon branch és ág-specifikus `DIRECT_URL` a Vercelben, vagy a séma-push kivétele az előnézeti buildből. A kapcsolati stringek titkok, ezeket nem kezelem.

## Pénz-migráció (0. fázis)

Érintett `Float` mezők (modell: mezők): Invoice, Quote, Order, DeliveryNote: `subtotal vatAmount total` · *Item táblák: `unitPrice vatRate total` · Expense: `amount vatAmount totalAmount eurAmount eurRate` · RecurringExpense: `amount` · Transaction: `amount` · Product/PriceListEntry: `costPrice salesPrice basePrice` · Deal: `value`.

Lépések, mind additívak:
1. Új, `Int`/`BigInt` centes **árnyék-oszlopok** a régi mellett (nullable).
2. Visszatöltő szkript: kerekítés egy helyen, `Math.round(x * 100)`, naplózott eltérésekkel.
3. Kettős írás: az új kódban minden írás mindkét oszlopot tölti.
4. Ellenőrző jelentés: régi és új oszlop összehasonlítása minden soron. Csak 0 eltérésnél lépünk tovább.
5. Olvasás átállítása az új oszlopra. A régi oszlop még marad.
6. A régi oszlop törlése csak külön, tesztkörnyezetben bizonyított lépésben.

## 0. fázis további elemei
- **Actor-modell:** külön kulcs és név ügynökönként (Arthur, Gabi GPT-je), a hívó neve minden írásba; jogosultsági profil a `server.tool` burkolóban. A meglévő `MCP_SECRET` változatlanul „Arthur"-ként működik tovább.
- **Pénzügyi szabályok a szerveren:** nettó + ÁFA = bruttó ellenőrzés, véglegesítés külön jogosultság.

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

## Nyitott kérdések Lacinak
1. Neon branch + ág-specifikus `DIRECT_URL` a fejlesztői ághoz (blokkoló a pénz-migrációhoz).
2. Gabi GPT-jének profilja: teljes vagy korlátozott (javaslat: korlátozott).
3. Az augusztusi ZIP elérhető-e a fejlesztéshez, és milyen formában.
