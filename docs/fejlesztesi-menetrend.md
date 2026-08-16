# Fejlesztési menetrend — 2026 ősz → 2027 Q1

**Ez a dokumentum az átadás.** Ha új sessionben folytatod a fejlesztést, ezt olvasd el
először: itt van a sorrend, a munkamódszer és minden projekt-specifikus buktató.

Készült Laci, Arthur (ChatGPT) és Claude közös elemzéséből, 2026. augusztus.

**Kapcsolódó dokumentumok:**
- **Jel-higiénia** — a diagnózis, mi a baj és miért (artifact):
  https://claude.ai/code/artifact/22910280-9998-418f-b20d-c6124843c872
- **Menetrend** — ugyanez vizuálisan, lefedettségi táblával (artifact):
  https://claude.ai/code/artifact/3b18f932-9c9f-4c72-a4e9-f0c3052f3d12
- `docs/lead-partner-temeto.md` — a már megvalósított életciklus-modell
- `docs/arthur-napi-futasok.md` — az ügynök ütemezett futásai

---

## 1. A kiindulópont — miért csináljuk

Az elmúlt 7 nap mérése: **35 új feladat, 12 elkészült, nettó +23** elvarratlan szál.
79 nyitott feladat, ebből 32 lejárt. Az új megkeresés 0/20, a forgalom 1 266 / 6 000 €.

A CRM **okos feladatgyár, de még nem végrehajtó rendszer**: az észrevételből túl gyakran
új feladat lesz, végrehajtás vagy régi feladat lezárása helyett.

A gyökérok kódnyelven:

> Minden jelzés-forrás külön fut (`reorderDue`, `pendingReplies`, `dailyFacts`,
> cél-haladás, feladatgenerálás), és amit egyszer legyárt, azt **soha nem vonja vissza**.
> Egyik sem nézi meg: megtörtént-e már, mit mond a másik objektum, van-e már ilyen feladat.

Vezérelv, ami ebből következik:

> **Amit a rendszer ki tud számolni, azt ne materializálja feladatként.**

---

## 2. Üzleti keret (amiért az egész van)

- **Akvizíciós út:** hideg bemutatkozó csomag a leválogatott célcsoportnak → kézbe veszi
  → a legkönnyebb következő lépés a **3 kötelezettségmentes minta**
  (Graphitoptik · Aquarell · 2-rétegű bélyeg), AI-generálva, kis ráfordítással.
- **Szezon:** a partnerek jellemzően január–márciusban rendelnek, de a bemutatkozás
  **folyamatos üzem** — épp mert a konverzió szezonális, és az átfutás hónapokban mérhető.
  A cél, hogy a Memini ne legyen szezonfüggő.
- **Kapacitás:** heti ~20 óra Laci-figyelem fejlesztésre, de az üzleti munka elsőbbséget
  élvez → **egyszerre egy építési szál**. A párhuzam az üzleti oldalon van.
- **Kockázat:** a bevétel 60–70%-a az Ulmer Münsterhez kötődik, kézfogásos alapon.
- **Határidő:** december 20-tól fagyasztás. Januárban már ne rendszert építsünk.

---

## 3. Az építési sorrend

A sorrend úgy van felállítva, hogy **ha bármelyik ponton elfogy az idő, a kész részek
önmagukban is értéket adjanak**.

### 0. blokk — Védőkorlátok · ~1 hét (ebből kettő nem is kód)

**Ez nem halasztható „későbbi biztonsági körre".** Arthur olvassa a beérkező
leveleket és sok írási joga van — ez az AI-működés belépő feltétele.

**A fenyegetés-modell pontosítása (fontos!):** a „töröld az összes partnert"
forgatókönyv **már architekturálisan halott** — nincs törlés, csak temető, onnan
visszahozás. A CRM ebből a szempontból jól védett: **nincs cég-, kapcsolat- vagy
feladattörlő MCP-tool, és nincs levélküldő tool sem — csak piszkozat-készítő.**

A valódi kockázat három másik dolog:

1. **Adatkiszivárgás** — Arthur olvassa a `costPrice`-t (ebből az árrés
   kiszámolható), a teljes partnerlevelezést, számlákat, árlistát. Ez nem töröl
   semmit, mégis a legdrágább kár, és **nem visszavonható**.
2. **Csendes rontás** — nem törlés, hanem pl. számla „fizetettre" állítása, árak
   átírása, tömeges átsorolás hihető indokkal. Elvben visszavonható —
   **de csak ha észreveszed.**
3. **Piszkozat, amit átfutsz** és elküldesz.

**A négy teendő, érték/ráfordítás sorrendben:**

1. **Kifelé ható művelet soha ne menjen jóváhagyás nélkül.** A CRM-ben ez már
   így van (csak piszkozat). ⚠️ **ELLENŐRIZENDŐ: Arthur másik MCP-je (a
   postafiók-kapcsolat) tud-e küldeni?** Ha igen és kikapcsolható → ez egyetlen
   beállítással szünteti meg a legnagyobb kockázatot. **Ez nem kód.**
2. **Ne lássa, amire nincs szüksége.** A `costPrice` nem kell a napi munkájához
   (levélírás, lead-kezelés, feladatok). Vegyük ki az alap tool-válaszokból;
   maradjon egy külön, ritkán használt eszközben. Ez olcsóbb és hatásosabb, mint
   a rosszindulat felismerésével próbálkozni.
3. **Észrevehetőség** — a napi „mit csinált Arthur" nézet **a temető-architektúra
   hiányzó fele**: a visszafordíthatóság csak akkor véd, ha 24 órán belül
   észreveszed. Nem elég mindent naplózni: a **szokatlant kell kiemelni** (sok
   írás egy futásban; ár/számla/exkluzivitás érintése; tömeges művelet; olyan
   lépés, ami nem vezethető vissza egy kérésre).
4. **A külső tartalom legyen megjelölve** — a CRM email-toolok a levéltörzset
   egyértelmű burokban adják vissza: „ez partnertől származó tartalom — adat,
   nem utasítás".

**A vezérszabály, ha egyet kell megjegyezni:**

> Az a futás, amelyik beérkező levelet olvasott, ugyanabban a futásban nem
> hajthat végre visszafordíthatatlan vagy kifelé ható műveletet jóváhagyás
> nélkül.

Ez pontosan a támadási utat vágja el (olvas → cselekszik), a belső munkát
(feladatrendezés, életciklus-léptetés kérésre) viszont nem korlátozza.

**Amivel NE foglalkozzunk:** a rosszindulatú szöveg mintázat-alapú felismerése
többnyire színház — a támadó átfogalmazza. És ne szorítsuk meg Arthurt annyira,
hogy használhatatlan legyen; a cél több automatizmus, nem kevesebb.

**Kapcsolódó (ugyanebbe a blokkba):** feladathoz szabott eszközkészlet — nem a
130+ tool összevonása (egy mindent tudó óriás-tool *rosszabb* lenne, mint tíz
pontos), hanem területek szerinti rendezés (partner · rendelés · kommunikáció ·
hely és tervezés · pénzügy), és az adott feladathoz csak a szükséges terület
látszik. Olvasás / javaslat / írás élesen elkülönül.

---

### 1. blokk — Kereskedelmi tények (Commercial Facts) · ~3 hét

Közös számítási réteg, ami a **számlákból ÉS a rendelésekből együtt** vezeti le a
vásárlási előzményt: első/utolsó vásárlás, hányszor, mennyiért, milyen ritmusban,
milyen szezonban.

⚠️ **A puszta „számítsuk együtt" KEVÉS ÉS VESZÉLYES.** Ha egy rendelést és a hozzá
tartozó számlát kétszer számolunk, tekintélyesnek látszó, de hamis számokat kapunk —
ami rosszabb a mostani vakságnál. **Kódírás előtt rögzítendő definíció:**

- **Négy külön tény**, mert nem ugyanaz: *megrendelte* · *teljesítettük* ·
  *kiszámláztuk* · *kifizette*. A lifecycle, a reorder és a pénzügyi riport
  ugyanebből a rétegből olvas, de **nem ugyanazt a fogalmat** használja.
- **Rendelés + a hozzá kapcsolt számla = EGY esemény** (a számlán van
  rendelés-hivatkozás → nem duplázunk).
- **Árva számla** (nincs mögötte rendelés) = önálló kereskedelmi esemény —
  pontosan ez az Ulmer Münster 19 esete.
- **A reorder a *teljesítettből* számol**, nem a függőből.
- **Dátum:** ami a boltba érkezést jelenti — kézbesítés (ha ismert) → számla →
  rendelés sorrendben.
- **Sztornó és jóváírás csökkent.** **Nettó** értéken. Devizánál a tranzakció
  napi árfolyamán EUR-ra.

- **NEM gyártunk mű-rendeléseket a számlákból** — az duplikációt és későbbi egyeztetési
  problémát okozna. Aggregáló **service**, nem materializált tábla (először).
- Előbb **árnyék-mód**: számol és mutat egy eltéréslistát („most így van → így lenne →
  miért"), nem ír át semmit. Laci hagyja jóvá.
- Ráadás ebben a blokkban: **valódi reorder-pontszám** (a puszta „hány napja nem
  beszéltünk" helyett) → döntési kártyák; és a **cél-haladás eredményből** számolva
  (rendelés, forgalom, mintakérés), nem az elvégzett admin-részfeladatok számából.

**Miért ez az első:** ez csökkenti leggyorsabban az Ulm-függőséget, és **ez válaszolja
meg a szezon-kérdést a saját adatokból** — nem elméletből. *(Szemantikai pontosítás: ez
önmagában nem „a leggyorsabb pénz" — a pénzt a szunnyadó partnerek reaktiválása hozza.
Ez adja hozzá a **látást**, ami nélkül az nem indulhat el.)*

**Konkrét motiváló eset:** az Ulmer Münsternek 19 számlája van, `lifecycle: partner`,
`classification: A` — de 0 rendelés, üres `firstOrderDate`/`lastOrderDate`. A rendszer
tudja, hogy partner, de **nem tudja, hogy vásárolt**. (A kézi életciklus-léptetés nem
tölti a `firstOrderDate`-et; azt csak a `promoteToPartnerIfNeeded` teszi rendelésből.)

### 2. blokk — AI-ready Core: jel-higiénia + identitás · ~3–4 hét

- **Actor** minden változáson: `actorType` (human / agent / system) + `actorId`, plus
  ki kezdeményezte / hajtotta végre / hagyta jóvá.
  ⚠️ **Ez visszamenőleg pótolhatatlan** — az adat egyszerűen nem keletkezik. Ezért most.
- **Forrás-kulcs** (`sourceKey`) az automata feladatokon, pl. `reorder:{companyId}:{ruleVersion}`,
  `delivery-check:{orderId}`. Egyedi korlát: ugyanaz a trigger **frissít, nem duplikál**.
  Mellé: `sourceType`, `ruleVersion`, `evidenceType`, `evidenceId`, `autoResolvedAt`,
  `suppressedUntil`, `suppressionReason`.
  ⚠️ **`humanTouched` jelző kell**: amit ember már lezárt/átírt, azt a trigger **ne
  támassza fel**.
- **Bizonyíték-alapú lezárás** — deklaratívan megírva, mi nyit és mi zár.
  ⚠️ **`shipped` ≠ `delivered`**: a feladás *elindítja* a kézbesítés-figyelést, nem lezárja.
- **Számított jelzések** perzisztált feladatok helyett + **strukturált elnémítás**:
  `nextContactNotBefore`, `contactSuppressed`, `suppressionReason`, `stockReportedUntil`,
  `waitingForPartner`, `doNotAutomate`, `internalOrTestRecord`.
- **Ígéret-követés**: amit levélben vállaltunk, rekordot kap, és **magától lezárul**,
  ha a bizonyíték megjön (kiment levél, kiállított számla, feladott csomag).
- **E-mail-sorozat higiénia**: válasz / mintakérés / rendelés azonnal leállítja a
  sorozatot; lost dealnél a follow-upok zárnak; teljes szál értelmezése; duplikátum-felismerés.
- **Az ügynök javasol, nem gyárt**: automatikus feladat helyett max. 5 döntési kártya.

### 3. blokk — Order Control V0 · ~3–4 hét

Minden rendelésnél **egyetlen aktuális állapot és egyetlen következő lépés**, végrehajtóval:

```
rendelés → tételellenőrzés → készlet → gyártás → összekészítés → feladás
        → kézbesítés → számla → fizetés → reorder-időzítő
```

Nem a teljes automatizálás — a lánc, ami nem ejt el semmit.

**Miért az akvizíció ELŐTT:** felső szűk keresztmetszetet nem szabad kinyitni anélkül,
hogy az alatta lévő kapacitást megnéznéd. Ha az akvizíció beindul és a rendeléskezelés
törik, az **Gabin csattan**.

**Gabi a fő tesztelő** — az ő valós folyamatát képezzük le. A 4 függő rendelésen pilotolva
(Villa, Mara, Heidelberg Marketing, Die Einsteins).

### 4. blokk — Place · Point of Sale · Exkluzivitás (vékonyan) · ~5 hét

Három tiszta objektum szétválasztva:

| Objektum | Mit jelent | Mit hajt |
|---|---|---|
| **Company** | aki szerződik és fizet | szerződés, számlázás |
| **Place** | amiről a terméket készítjük (Ulmer Münster, Tübingen) | **tervezés** |
| **Point of Sale** | a konkrét bolt: cím, koordináta, nyitvatartás, kapcsolat | **útvonal** |

Plusz **Exclusivity Preflight**: mielőtt bármilyen külső terv vagy ajánlat készül, lefut
az ellenőrzés (hely, motívum, termékforma, partner, PoS, terület, időszak, mennyiségi
vállalás, ideiglenes foglalás).

⚠️ **A LEGVESZÉLYESEBB CSAPDA: a „nincs találat" NEM jelent szabad utat.** A Memini
megállapodásai kézfogásban, levélben és jegyzetben élnek — *nem adatbázisban*. Ha az
üres tábla „szabadot" jelentene, a rendszer magabiztosan veszítene partnert. Ezért
**négy** lehetséges kimenet kell, nem kettő:

| Kimenet | Jelentés | Mi történik |
|---|---|---|
| **SZABAD** | nincs korlátozás, az adat ellenőrzött | mehet |
| **KORLÁTOZOTT** | van élő megállapodás | tilos |
| **LEJÁRT** | volt, de már nem él | mehet, jelezve |
| **NEM TUDNI** | nincs elég adat a döntéshez | **az AI megáll és emberi döntést kér** |

Minden korlátozáshoz tartozik: forrás/dokumentum, ki erősítette meg, mikor ellenőriztük,
motívum, termékforma, partner, PoS, terület, időszak, mennyiségi feltétel.

⚠️ **Az exkluzivitás nem kényelmi funkció, hanem üzleti kárelhárítás.** Ha egy ügynök
Mara tübingeni motívumát felajánlja egy másik tübingeni boltnak, az valódi kár.

⚠️ **VÉKONYAN.** Hely, típus, régió, kapcsolódó partnerek, motívumlista, exkluzivitás —
ennyi. Kollekció, jogi ontológia, verziózott designfa: **2027**. Ez az a pont, ahol a
projekt féléves szörnnyé tud hízni.

**Bónusz:** ez lesz az Ulm-szerződés mellékletének alapja.

### 5. blokk — Területi klaszterek + Q1 élesítés · ~3 hét

A Point of Sale-okból **régiós útvonal-nézet**: kik vannak egy körzetben, mikor tartanak
nyitva (`businessHours` már megvan, szezonális override-okkal!), milyen sorrendben
érdemes végigmenni, helyszínre kész dossziékkal.

**December 20-tól nem nyitunk új nagy fejlesztést.** Csak hibajavítás és januári felkészülés.

---

### Fontos pontosítások — kódírás előtt olvasd el

Ezek olyan finomítások, amiket menet közben javítani drága vagy lehetetlen.

**Két igazságforrás, egy egyeztető réteg (BLOKKOLÓ).** Rossz kérdés, hogy „melyik
legyen *az* igazság" — mindkettő más dologban hiteles. A **postafiók a kommunikáció
bizonyítéka** (mi ment ki, mi jött be, mikor, milyen szöveggel); a **CRM az üzleti
állapot forrása** (hol tart a partner, mi a következő lépés, van-e ígéret). Egy
egyeztető réteg köti össze — egyik sem írja vakon felül a másikat.

**A `sourceKey` mellé `occurrenceKey` + bizonyíték-ujjlenyomat kell.** A „amit ember
megérintett, az sose támadjon fel" túl merev: ha augusztusban elnémítottad, mert volt
készlete, de januárban **új bizonyíték** jön (új rendelés, új szezon), az **jogosan**
hozhat új jelzést. A régi elnémítás nem némít örökre.

**Reorder ≠ inaktivitás — két külön rendszer.** Az *inaktivitási figyelmeztetés*
(„régóta nincs aktivitás") túl agresszív → fokozzuk le jelzéssé. A *reorder-motor*
(vásárlási előzményből becsül, szezon-ablakkal) **nem buta, csak alultáplált** — nem
látja a számlákat és az elnémító kontextust. **Etetni kell, nem lecserélni.**

**Rendelés: egy blokkoló lépés + kontrollált párhuzamosok.** A merev „mindig pontosan
egy következő lépés" mesterségesen lassítana: párhuzamosan lehet készletet ellenőrizni,
címet pontosítani és gyártói határidőt kérni. Egy *elsődleges blokkoló* lépés van,
mellette néhány nem-blokkoló.

**A ChangeSet egyszerűsíthető, de négy elem nem hagyható ki:** (1) ugyanaz a jóváhagyott
művelet kétszer ne fusson le; (2) **előfeltétel-ellenőrzés** — ha Laci 9:00-kor jóváhagy,
de Gabi 9:05-kor módosít, 9:10-kor ne az elavult terv fusson; (3) eredményjegyzék (mi
sikerült, mi nem); (4) részleges hiba kezelése, mert levélküldés + CRM-frissítés nem
tehető egy tranzakcióba. *(Ami tényleg ráér: az automatikus kompenzációs gépezet.)*

**A jóváhagyási küszöb NE darabszám alapú legyen.** Egyetlen művelet is lehet kritikus
(exkluzivitás, ár, külső levél, partner elveszettnek nyilvánítása); ötven rekord lehet
ártalmatlan (hiányzó országkód). A szabály művelettípus szerint: ami *kifelé hat*, ami
*pénzt érint*, vagy ami *nehezen visszavonható* → mindig jóváhagyás.

**Visszavonás: három kategória.** *Visszafordítható* (belső mező, státusz) ·
*kompenzálható* (számla sztornó, rendelés törlése) · **visszafordíthatatlan** (kiment
levél, megmutatott terv, feladott csomag → ezekhez mindig ELŐZETES jóváhagyás).

**Az AI ígéretet javasol, nem rögzít.** „Holnap visszajelzünk" ≠ „remélhetőleg holnap
tudunk válaszolni" ≠ „amint megkapjuk a gyártó válaszát". Az AI *feltételezett ígéretet*
ad bizonyossággal és a forrásmondattal, **megerősítésre várva**; a véglegesítés ember
vagy egyértelmű szabály dolga.

**A „válasz érkezett → sorozat leáll" túl primitív.** Osztályozni kell: érdemi pozitív ·
érdemi elutasítás · információkérés · „nem én vagyok az illetékes" · szabadság-értesítő ·
visszapattanó · leiratkozás · „keressen februárban" · automatikus visszaigazolás. Egy
szabadság-értesítő nem ok a leállásra.

**Múltbeli érték ≠ jövőbeli potenciál.** Az A/B/C/D-t nem szabad pusztán forgalomból
számolni: egy Ulmer Münster-szintű **új** prospekt automatikusan „D" lenne, miközben a
lista legfontosabb szereplője. Két mező: *kereskedelmi érték* (számított) és *stratégiai
potenciál* (kézi ítélet).

**Mérés ≠ tanulás, és az elfogadási arány ≠ minőség.** Egy változtatás nélkül elküldött
levél lehet kényelmes, de üzletileg gyenge. Mérni kell a **valódi kimenetet** is
(válaszolt-e, kért-e mintát, lett-e rendelés, jött-e panasz). Utána emberi
felülvizsgálati kör → sablon/prompt módosítás → verzióváltás. **Automatikus
önmódosítás nincs.**

**Pénzügyi számok, amik szép hazugságot gyártanának.** Az *árrés* csak akkor valós, ha
benne van a csomagolás, szállítás, selejt, minta, egyedi grafika, kedvezmény, visszáru
→ három szint (nyers · fedezet · becsült teljes). A *pénzforgás*-nál a függő rendelés
még nem pénz → három nézet (biztos · várható · optimista), a kiadási oldallal együtt.

**Egy törölt túlállítás:** a sorozat-leállítás a *kommunikációs kockázatot* csökkenti,
de **nem bizonyít GDPR-megfelelést** — az külön átvilágítás.

---

## 4. Lefedettség — a 16 diagnosztizált probléma

| # | Probléma | Hol oldódik meg |
|---|---|---|
| 1 | Partner, de nem tudjuk hogy vásárolt (Ulmer Münster) | 1. blokk |
| 2 | Három helyen három válasz ugyanarra | 1. blokk |
| 3 | Zaklatja azt, akinek van készlete (Evangelische) | 2. blokk — elnémítás |
| 4 | Halott ügy még „válaszra vár" (Tourist-Info Altes Land) | 2. blokk — számított jelzés |
| 5 | Régi üzenet külön riaszt (Mara 3 szála) | 2. blokk — szál-értelmezés |
| 6 | Belső cégünk üdvözlő levelet kapna | 2. blokk — belső/teszt jelző |
| 7 | Feladva, de a kézbesítés-check lejártan lóg (HLFF) | 2. + 3. blokk |
| 8 | A rendelés nem vezérli a következő lépést | 3. blokk |
| 9 | A feladatszám elfedi az igazi haladást | 1. blokk — cél-haladás eredményből |
| 10 | Hetente +23 elvarratlan szál | 2. blokk |
| 11 | Egy ügyből öt feladat, felelős nélkül | 2. + 3. blokk *(részben)* |
| 12 | Az ügynök munkát talál, nem vesz le | 2. blokk — javaslat feladat helyett |
| 13 | Az ígéreteket senki nem tartja számon | 2. blokk — ígéret-követés |
| 14 | A reorder-pontszám túl buta | 1. blokk — döntési kártyák |
| 15 | Kevés a megkeresés (Lead Launch Engine) | üzleti szál + 5. blokk *(részben)* |
| 16 | A sorozatok nem elég okosak | 2. blokk — e-mail higiénia |

**#11** — az „egy ügy, egy következő lépés" a rendelésekre és az automata feladatokra
megvan; a teljes, minden objektumra kiterjedő általánosítás nem fér a decemberi ablakba,
és a haszon 80%-át a forrás-kulcs + bizonyíték-lezárás már meghozza.

**#15** — az AI-kutató Lead Launch Engine 2027-es téma: előbb a Hármas Horog pilotból
kell tudni, hogy a hideg csomagos motion egyáltalán milyen arányban konvertál.

---

## 5. Munkamódszer — hogy ne csesszük szét, ami működik

A mostani rendszer **él és hasznos**. Nem duplikálunk, nem írunk újra — hozzáteszünk,
úgy, hogy bármikor vissza lehessen lépni.

1. **Ág, nem fork.** Külön git-ágon dolgozunk, PR-enként. Amíg nem mergelünk, az éles
   rendszer érintetlenül fut. (Teljes rendszer-duplikálás **rossz ötlet**: az új DB az
   első naptól avulni kezd, és két igazság-forrás lesz — pont az a betegség, amit gyógyítunk.)
2. **Csak additív séma.** Új mezők és táblák; a régi kód nem tud eltörni tőlük.
3. **Előbb árnyék-mód.** Az új logika számol és mutat egy eltéréslistát; ember hagyja jóvá.
   Élő adaton — nem egy avuló másolaton.
4. **Egymás mellett, kapcsolóval.** Az új nézet a régi mellé; összeveted; amikor megbízol
   benne, átbillented. Nincs nagy cutover.
5. **A veszélyes írás (tömeges backfill) legutolsó** — friss mentés után, eldobható
   adatmásolaton (Neon DB-ág vagy visszatöltött napi mentés) előtesztelve.
6. **Egyszerre egy építési szál.**

---

## 6. Projekt-specifikus tudnivalók

### Fejlesztés

- **Ág:** `claude/szia-bwnzve` · **production ág:** `claude/build-crm-system-LnYzW`
- **Ellenőrzés commit előtt:** `npx tsc --noEmit -p tsconfig.json` és `npx next build`.
  Lokálisan nincs DB, ezért dummy env kell:
  ```bash
  DATABASE_URL="postgresql://u:p@localhost:5432/db" \
  DIRECT_URL="postgresql://u:p@localhost:5432/db" \
  NEXTAUTH_SECRET="x" npx next build
  ```
- **ESLint nincs beállítva** (interaktív setupot kér) — a `tsc` + `build` a mérvadó gate.
- **Kommentek és UI magyarul**, a kód angolul. A meglévő stílushoz igazodj.
- **PR-enként szállítunk**, magyar commit-üzenettel és leírással.

### Adatbázis / deploy

- **Nincs migrations mappa** — `prisma db push` alapú, séma-vezérelt.
- A `vercel.json` `buildCommand`-ja **deploykor lefuttatja a `prisma db push`-t**, tehát
  az additív séma-változások automatikusan kimennek. Nincs utólagos teendő.
- ⚠️ Van egy **duplikátum Vercel-projekt**, aminek a Root Directory-ja `memini-sales`-re
  van állítva — ilyen mappa nincs a repóban, ezért **minden buildje elhasal**, és piros
  pipákat rak a repóra. Az éles appot nem érinti. Megoldás: azt a projektet a Vercelen
  Settings → Git → Disconnect (vagy törlés).

### MCP / Arthur

- Az MCP a `src/app/api/mcp/route.ts`-ben él (~3700 sor, 130+ tool).
- ⚠️ **Új tool után Arthur connectorát frissíteni kell** a ChatGPT-ben — a tool-katalógus
  cache-elve van, különben nem látja az újat.
- ⚠️ **Ne használj szabad formájú, mélyen ágyazott objektum-paramétert** (pl.
  `z.record(z.string(), z.unknown())`) — a ChatGPT connector hívás-formátuma elakad rajta.
  Ez okozta a `save_daily_journal` blokkolását; a megoldás: JSON-**szövegként** átvenni és
  szerveroldalon parse-olni. A jól definiált record (string→string, string→number) rendben van.
- Egyetlen közös `MCP_SECRET` van, **nincs per-ügynök identitás**. A 2. blokk actor-modellje
  ennek az alapja; a teljes per-ügynök kulcs/scope későbbi lépés.

### Ami már kész (ne építsd újra)

- **Életciklus** (`src/lib/lifecycle.ts`): prospect → cold_lead → warm_lead → interested
  → partner → inactive, plusz lost_lead / lost_partner. Napló: `LifecycleEvent`.
  Kötelező indok a temetőhöz. Részletek: `docs/lead-partner-temeto.md`.
- **Temető és archiválás**: cég → temető, kapcsolat/feladat → archiválás. A kuka **soha nem
  töröl**. Feladat-mennyország: `/feladat-archivum`.
- **Meleg lead e-mail-sorozat**: `Company.emailSequence` (Json), központi sablon
  (`EmailTemplateStep` tábla, Beállítások → Email-sorozat sablon), kéthasábos levél-szerkesztő
  (küldendő + magyar kontroll), a Fókuszban napi „kinek kell írni".
  MCP: `list_due_lead_emails`, `set_lead_email_draft`, `mark_lead_email_sent`,
  `get_email_sequence_template`.
- **Memini Brain**: `BrainNote` (decision / learning / idea / open_loop / setback /
  opportunity), napi napló (`DailyJournal`), heti trend, magyar full-text keresés
  (`src/lib/knowledgeSearch.ts`).
- **Biztonság**: MCP fail-closed auth, cron-útvonalak a middleware alól kivéve, privát
  backup-blob, login-lockout, setup-végpont védve.

---

## 7. Arthur-hatékonyság — hogy jobban és szabadabban dolgozhasson

Ezek nem külön projekt: nagyrészt a 2. blokk naplózására és actor-modelljére épülnek,
egy részük viszont bármikor beszúrható.

### Hogy szabadabban dolgozhasson (a bizalom mechanikája)

A szabadság nem elhatározás kérdése — attól nő, hogy **mennyire olcsó a hiba**.

- **Dry-run az írásokon.** `dryRun` kapcsoló az író toolokon: Arthur megkérdezheti,
  „mi történne", és listát kap végrehajtás helyett. Nagyobb műveleteket is meg mer nézni.
- **Visszavonás actor szerint.** „Vond vissza, amit Arthur ma 14:00 után csinált." A napló
  (`actor` + időbélyeg) a 2. blokk után megvan; egy visszajátszó réteg kell rá.
  **Ez az egyetlen legerősebb dolog**, amitől több szabadság adható: ha minden visszavonható,
  a rossz döntés nem katasztrófa.
- **Küszöbök a jóváhagyáshoz.** Ne binárisan „szabad / nem szabad" legyen, hanem mennyiség
  szerint: 1–5 rekord magától, 20 fölött engedélykérés. Egy céget temetőbe rakni szabad,
  tízet nem. **Állítható autonómia-gomb**, amit a bizalom növekedésével feljebb tekersz.
- **Napi „mit csinált Arthur" nézet.** Ha 30 másodperc alatt átfutod a tegnapi műveleteit,
  sokkal könnyebben adsz több jogot. A napló megvan — csak meg kell mutatni.

### Hogy hatékonyabban dolgozzon (tool-felület)

- **Összevont „briefing" toolok.** Ma egy teljes partnerkép 5–6 külön hívás (cég +
  aktivitások + rendelések + levelek + brain-jegyzetek). Helyette **egy**
  `get_company_briefing(id)`, mindent egyben, előrendezve. A minta bevált: a
  `get_daily_facts` pont ilyen. Kevesebb hívás = kevesebb token, kevesebb tévedés, gyorsabb.
- **Kötegelt írás.** 20 cég átsorolása ma 20 hívás — lassú, félúton elakadhat. Egy
  `batch_update` egy hívásból, atomikusan.
- ⚠️ **130+ tool van** — ez már azon a határon, ahol a modell tool-választása romlani kezd.
  Nem sürgős, de a bővítést **összevonással** kell csinálni, ne további külön toolokkal.

### Visszacsatolás — amitől Arthur idővel jobb lesz

**Arthur ma nem tudja, hogy jól dolgozott-e.** Megírja a levelet, de sosem tudja meg,
elküldted-e úgy, átírtad-e, vagy eldobtad. Ugyanez a lead-besorolásnál és a döntési
kártyáknál.

Ha ezt **mérjük** (a piszkozatot változatlanul használtad / szerkesztetted / eldobtad),
az kettőt ad: **neked** számokban mutatja, mennyire megbízható — ebből tudod, hol adhatsz
több szabadságot; **Arthurnak** pedig a sablon és a prompt valós visszajelzésből javítható,
nem érzésből. Enélkül Arthur örökre ugyanolyan jó marad, mint az első napon.

### Beosztás

| Elem | Hova |
|---|---|
| Visszavonás actor szerint · napi Arthur-nézet | 2. blokk — a naplóra épül |
| Dry-run · küszöbök | 2. blokk — az elnémítással egy körben |
| Briefing toolok · kötegelt írás | **külön kis kör, bármikor beszúrható** (~pár nap) |
| Visszacsatolás mérése | 2. blokk vége vagy önálló kis kör |
| Tool-összevonás | **elv, nem feladat** — mostantól így bővítünk |

A **briefing toolok + kötegelt írás** az egyetlen, ami akár azonnal jöhet: nem függ
semmitől, és Arthur holnaptól gyorsabb tőle.

---

## 8. Ami közben az üzletben fut (nem fejlesztés)

- **Most azonnal:** karácsonyi ablak-ellenőrzés — kik rendeltek aug–okt között az elmúlt
  3 évben? Arthur a meglévő toolokkal összeállítja, nem kell hozzá fejlesztés.
- **Most indul:** Hármas Horog 20 pilot — 10 partner csak csomaggal, 10 csomag + egyetlen
  gyors helyspecifikus vizuállal. Mérjük: válasz, mintakérés, beszélgetés, rendelés, idő.
- **Szeptembertől:** dormant reaktiválás — 15–20 meglévő partner döntési kártyával.
- **Okt–dec:** Q1 pipeline előkészítés.
- **Folyamatos:** hideg bemutatkozó csomagok.

---

## 9. Nyitott döntések

1. **Szakvásár (Ambiente / TrendSet) — igen vagy nem?** Az egyetlen csatorna, ami
   egyszerre oldja a jogi (nincs hideg e-mail), a volumen- és a személyesség-korlátot.
   A jelentkezési határidők hónapokkal előbb zárnak, tehát a „majd megnézzük" = nem.
2. **Van-e két beszerzési ablak az évben?** Erre a saját számlák válaszolnak — az 1. blokk
   első riportja.
3. **Mennyi egy darab egyedi mágnes, ha egyetlen példány készül?** Ez dönti el, lehet-e
   maga a kész termék az első érintés.
4. **Ulm: szerződés és kapacitás-lekötés.** A kézfogás nem éli túl a shop-vezető cseréjét.

---

## 10. Hol kezdődik a következő session

**1. blokk, első lépés — kockázatmentes, egy sort sem ír át élesben:**

1. `src/lib/commercialFacts.ts` — olvasó szolgáltatás, ami cégenként a rendelésekből ÉS
   számlákból számol (első/utolsó vásárlás, darab, összeg, ritmus, szezon).
2. Egy „Kereskedelmi előzmény" nézet a meglévő mellé (nem helyette).
3. **Árnyék-diff riport**: mit írna át (életciklus, `firstOrderDate`/`lastOrderDate`,
   reorder-jelöltek) — csak lista, semmi írás.
4. Az első szezonalitás-riport: melyik hónapokban érkeztek a rendelések/számlák.

Utána Laci átnézi a diffet, és csak jóváhagyás után élesítünk bármit.
