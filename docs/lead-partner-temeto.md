# Lead — Partner — Temető: az életciklus-modell és a megvalósítás

**Állapot:** terv (kód még nincs belőle)
**Készült:** 2026-08-09

---

## 1. Miért kell ez

Ma a CRM-ben nincs egyetlen mező sem, ami megmondaná, hogy egy cég **hol tart a
Meminivel való kapcsolatában**. Ami van:

| Mező | Mit jelent ma | Mi a baj vele |
|---|---|---|
| `Company.partnerType` | Múzeum / vár / kastély / bolt — **milyen típusú hely** | Nem életciklus. Egy prospekt és egy 5 éve rendelő partner is „Museum". |
| `Company.classification` | A/B/C/D — **mennyire értékes** | Nem életciklus. Alapértelmezés `D`, ezért mindenki D. |
| `Company.channel` | Honnan jött | Nem életciklus. |
| `Contact.status` | lead / contacted / meeting / proposal / active / lost | **Ez az egyetlen életciklus-szerű mező, de a rossz entitáson van.** |

Ebből három konkrét gond következik:

1. **A hideg lead és a valódi partner egy helyen van.** Amit Arthur felvesz egy
   listából kibányászott múzeumként, ugyanabban a céglistában landol, mint a
   partner, aki tavaly háromszor rendelt.
2. **Az életciklus a személyen van, nem a cégen.** A Memini nem embereknek ad el,
   hanem helyszíneknek. Ha a múzeumnál lecserélik a shop-vezetőt, az új embernél
   a státusz nulláról indul, pedig a *helyszín* rég partner. Fordítva is: egy
   múzeumnál három ember lehet a CRM-ben, három különböző státusszal — akkor most
   partner az a múzeum, vagy nem?
3. **Az elvesztetteket nem lehet eltenni az útból.** Aki visszamondta, ott marad
   az aktív listákban, vagy törölni kell — és a törléssel elvész az információ,
   hogy *miért* mondta vissza.

## 2. Az alapszabály, amiből minden más következik

> **Partnerré az első rendelés tesz valakit. Addig prospekt / lead / érdeklődő —
> és a partnerek közé nem keveredhet bele.**

És mellé egy második:

> **A kuka gomb soha nem töröl. Átrak a temetőbe.**

---

## 3. Az életciklus

Az életciklus a **cégen** él (`Company.lifecycle`), mert a partnerkapcsolat
alanya a helyszín (múzeum, vár, kastély, bolt), nem a benne dolgozó ember.
Egy cégnek pontosan egy életciklus-állapota van, mindig.

```
                          ┌──────── LEAD CRM ────────┐
                          │                          │
   prospekt  ──────►  hideg lead  ──────►  érdeklődő │
      │                    │                    │    │
      │                    │                    │ 1. rendelés
      │                    │                    ▼    │
      │                    │              ┌──────────┴──── PARTNER CRM ────┐
      │                    │              │                               │
      │                    │              │   partner  ◄────►  inaktív     │
      │                    │              │      │                │       │
      └────────┬───────────┘              └──────┼────────────────┼───────┘
               │                                 │                │
               ▼                                 ▼                ▼
        elvesztett lead                    elvesztett partner
               │                                       │
               └───────────────┬───────────────────────┘
                               ▼
                          ┌─── TEMETŐ ───┐
```

### 3.1 Az állapotok

| Kulcs | Magyar név | Mit jelent pontosan | Hol látszik |
|---|---|---|---|
| `prospect` | **Prospekt** | Nem tudja, kik vagyunk. Egy excel mélyéről bányásztuk elő. Érdemes lenne megkeresni — pl. bemutatkozó csomaggal. Még semmi nem történt. | Lead CRM |
| `cold_lead` | **Hideg lead** | Megkerestük: kiment a csomag / az email / telefonáltunk. **Válasz még nincs.** | Lead CRM |
| `interested` | **Érdeklődő** | Visszajelzett, tetszik neki, kéri a 3 egyedi mintát a saját helyszínéhez. **Még nem partner** — nem rendelt. | Lead CRM |
| `partner` | **Partner** | Legalább egyszer rendelt. Élő, aktív kapcsolat. | Partner CRM |
| `inactive` | **Inaktív** | Partner volt, egy ideje nem rendelt. **A kapcsolat él**, csak csendes — visszahozható. Nem temető. | Partner CRM |
| `lost_lead` | **Elvesztett lead** | Sosem lett partner: visszajelzett, hogy nem érdekli, vagy végleg elhalt a dolog. | Temető |
| `lost_partner` | **Elvesztett partner** | Partner volt, és **kilépett a partnerségből**. | Temető |

**Miért két külön „elvesztett"?** Mert nem ugyanaz a státusz, és nem ugyanaz az
üzleti tanulság. Aki sosem mondott igent, arról azt tanuljuk, hogy a *megkeresés*
nem működött. Aki partner volt és elment, arról azt, hogy a *kiszolgálás* vagy a
termék nem tartotta meg. A temetőben ezért külön szűrhető a kettő, és a heti/havi
számokban is külön szerepelnek.

### 3.2 Az átmenetek és a szabályaik

| Átmenet | Hogyan | Kötelező indok? |
|---|---|---|
| `prospect → cold_lead` | Kézzel (húzás / gomb), vagy Arthur, amikor kiment a csomag | nem |
| `cold_lead → interested` | Kézzel, vagy Arthur, amikor beérkezik a pozitív válasz | nem |
| `interested → partner` | **Automatikusan az első rendeléskor**, plusz kézzel is | nem |
| `prospect/cold_lead → partner` | Kézzel is lehet (ritka: valaki azonnal rendel) | nem |
| bármelyik lead-állapot → `lost_lead` | Kézzel vagy Arthur | **IGEN** |
| `partner → inactive` | Kézzel; a rendszer *javasolja*, ha rég nem rendelt | nem |
| `inactive → partner` | Automatikusan új rendeléskor, plusz kézzel | nem |
| `partner/inactive → lost_partner` | Kézzel vagy Arthur | **IGEN** |
| temetőből vissza | Kézzel, célállapot választásával | nem (de kötelező megjegyzés) |
| **visszalépés** (pl. `interested → cold_lead`) | Megengedett — a valóság nem mindig előre megy | nem |

**Nincs olyan átmenet, ami törléssel jár.** Minden út a temetőbe vezet, nem a
semmibe.

### 3.3 A kötelező indok

Elvesztettbe **csak indokkal** lehet átlépni. Se húzással, se gombbal, se
Arthur-on keresztül nem megy másképp:

- **Felületen:** felugró ablak. A mező üresen az „OK" gomb *tiltott* (disabled).
  Minimum 10 karakter — az „x" vagy a „nem" nem indok. Amíg nincs szöveg, a
  húzás visszapattan, a kártya marad, ahol volt.
- **MCP-n (Arthur):** a `reason` paraméter kötelező (nem opcionális a sémában).
  Ha üres vagy 10 karakternél rövidebb, a tool hibát ad vissza és nem ír.

Az indok nem vész el: bekerül a cég rekordjába (`lostReason`), az
életciklus-naplóba, és megjelenik a temetőben a kártyán.

### 3.4 Az „inaktív" javaslat

Az `inactive` **nem áll be magától** — csak javasoljuk. A partnerlistában egy
halvány jelzés kerül a kártyára: „14 hónapja nem rendelt — inaktív?", és
egy kattintással átléptethető. Automatikus átléptetés azért nincs, mert egy
szezonális helyszín (kastély, ami télen zárva) simán kihagyhat 8 hónapot úgy,
hogy közben tökéletesen élő partner.

Küszöb: **12 hónap** az utolsó rendelés óta (`lastOrderDate`). Ez egy konstans a
kódban, egy helyen átírható.

---

## 4. A három felület

### 4.1 Lead CRM — a „Lead" fül

Kanban, **három oszlop**: Prospekt · Hideg lead · Érdeklődő.

- A kártya **cég** (nem személy), rajta a fő kapcsolattartó, város, típus,
  utolsó esemény ideje.
- Ugyanaz az adatlap, mint a partnereknél — **minden mező megvan**, csak más
  fülön látszik. Egy prospektnél is kitölthető a cím, a nyitvatartás, a
  megjegyzés; nem kell újra felvenni, ha partnerré válik.
- Húzással léptethető előre-hátra.
- **„Partnerré" gomb** a Érdeklődő-kártyán: átteszi a Partner CRM-be. Ez a
  kézi út; az automatikus az első rendelés.
- Fejlécben: **„🪦 Temető"** gomb.
- Konverziós arány: **hány prospektből lett partner** — az elvesztetteket a
  nevezőben számoljuk (mert azok is „kimenetel"), a még úton lévőket nem.

### 4.2 Partner CRM — a „Cégek" fül

A mai céglista, `lifecycle in (partner, inactive)` szűréssel.

- Az életciklus-badge megjelenik a kártyán/soron (Partner / Inaktív).
- Szűrő a meglévők mellé: életciklus.
- Fejlécben ugyanaz a **„🪦 Temető"** gomb.
- A kuka ikon **nem töröl**: megnyitja az indok-ablakot, és a temetőbe rak.

### 4.3 Temető — új oldal (`/temeto`)

- Két szekció / szűrő: **Elvesztett leadek** és **Elvesztett partnerek**.
- Kártyán: cég neve, mikor és **miért** vesztettük el, meddig tartott a
  kapcsolat, mennyit rendelt összesen (ex-partnernél ez a fájó szám).
- Kereshető.
- **„Visszahozás"** gomb: célállapot választásával (pl. egy ex-partner
  visszajön → `partner`, egy ex-lead újra megkereshető → `prospect`).
  A visszahozás is bekerül a naplóba.
- Ide **mindkét CRM-ből** el lehet jutni egy gombbal.

---

## 5. Az adatmodell

### 5.1 Company — új mezők

```prisma
model Company {
  // ... a meglévő mezők változatlanul ...

  /// Életciklus: prospect | cold_lead | interested | partner | inactive
  ///           | lost_lead | lost_partner
  lifecycle       String    @default("prospect")
  /// Mikor került a mostani állapotba (a "mióta érdeklődő?" kérdéshez)
  lifecycleSince  DateTime  @default(now())
  /// Az első rendelés napja — ez tette partnerré. Null, ha még sosem rendelt.
  firstOrderDate  DateTime?
  /// Csak lost_* állapotban töltött. A kötelezően megadott indok.
  lostReason      String?
  lostAt          DateTime?

  lifecycleEvents LifecycleEvent[]

  @@index([lifecycle])
}
```

### 5.2 LifecycleEvent — az életciklus-napló (új tábla)

Minden állapotváltás bekerül. Ez adja a temető „miért"-jét, a
„mennyi idő alatt lett partner" statisztikát, és Arthur ebből tudja
rekonstruálni egy cég történetét.

```prisma
model LifecycleEvent {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fromState String?  // null = a cég létrejötte
  toState   String
  reason    String?  // lost_* esetén kötelező
  /// ui | mcp | auto | migration — ki/mi léptette
  source    String   @default("ui")
  /// felhasználó neve vagy 'Arthur' vagy 'rendszer'
  actor     String?
  createdAt DateTime @default(now())

  @@index([companyId, createdAt])
  @@index([toState, createdAt])
}
```

### 5.3 Contact — mi lesz vele

A `Contact.status` **marad, ahogy van** (nem nyúlunk hozzá, nem törlünk adatot),
de **megszűnik életciklusnak lenni**. A lead-tábla ezentúl nem ebből dolgozik.
Jelentése ezután: a személy szerepe/állapota a cégen belül (kapcsolattartó,
már nem itt dolgozik, stb.).

Amire viszont szükség van, mert a kuka gomb a kapcsolatoknál is nem-törlő lesz:

```prisma
model Contact {
  // ...
  archivedAt     DateTime?
  archiveReason  String?
}
```

Az archivált kapcsolat eltűnik az aktív listákból, de az emailjei, aktivitásai,
számlái megmaradnak, és a cég adatlapján egy „Archivált kapcsolatok (2)"
lenyílóban visszanézhető. Visszaállítható.

### 5.4 A migráció (egyszeri besorolás)

A meglévő cégeknél az induló `lifecycle` értéket adatból vezetjük le. A szkript
**először csak riportot ír ki** (`--dry-run`), és csak külön kapcsolóval ír:

| Feltétel (sorrendben kiértékelve) | Kapott állapot |
|---|---|
| Van legalább 1 rendelése, és az utolsó ≤ 12 hónapja | `partner` |
| Van legalább 1 rendelése, de az utolsó > 12 hónapja | `inactive` |
| Nincs rendelése, de van elfogadott/kiküldött árajánlata **vagy** beérkező email tőle | `interested` |
| Nincs rendelése, de van kimenő aktivitás / email felé | `cold_lead` |
| Semmi nincs | `prospect` |
| Minden kapcsolattartója `lost` státuszú, és nincs rendelése | `lost_lead` (indok: „migráció: minden kapcsolat elvesztettként volt jelölve") |

A `firstOrderDate` a legkorábbi rendelés dátuma. Minden besorolás kap egy
`LifecycleEvent`-et `source: 'migration'`-nel — így később látszik, mi volt
kézzel és mi automatikus, és bármikor felülbírálható.

**Nem lesz automatikus `lost_partner`.** Aki rendelt már valaha, azt nem teszi a
gép a temetőbe — az emberi döntés.

---

## 6. A „soha ne töröljön" szabály

| Hol | Ma | Ezután |
|---|---|---|
| Cég kuka gomb (UI) | `DELETE /api/companies/[id]` — végleges | Indok-ablak → `lost_*` |
| Kapcsolat kuka gomb (UI) | `DELETE /api/contacts/[id]` — végleges | Indok-ablak → `archivedAt` |
| `DELETE /api/companies/[id]` | töröl | Átértelmezve: temetőbe rak. Indok nélkül **400**. |
| `DELETE /api/contacts/[id]` | töröl | Átértelmezve: archivál. |
| Arthur (MCP) | nincs cég/kapcsolat törlő tool | Marad úgy — helyette `move_company_to_cemetery` |

A többi entitás (`memory`, `subtask`, számlák, stb.) **egyelőre marad a mai
viselkedésnél** — a felhasználó kérése a CRM-emberekre és -cégekre vonatkozott.
A `delete_memory` és `delete_subtask` MCP-toolok maradnak, engedélykötelesként
(`destructiveHint: true`), ahogy korábban rögzítettük. A feladat-temető külön
feladat (lásd 10. pont).

---

## 7. Arthur (MCP) — mit kell tudnia

A felhasználó kérése: Arthur tudjon **létrehozni, szerkeszteni, léptetni, írni,
és temetőbe tenni**. A meglévő toolok bővítése és 5 új tool:

### 7.1 Bővítés a meglévőkön

| Tool | Változás |
|---|---|
| `create_company` | Új opcionális `lifecycle` paraméter (alap: `prospect`). Arthur alapból prospektet vesz fel — **nem keveredik a partnerek közé.** Létrejön az első `LifecycleEvent`. |
| `list_companies` | Új `lifecycle` szűrő. **Alapból kihagyja a `lost_*` cégeket** — a temetőt külön kell kérni, hogy ne szennyezze a napi munkát. |
| `get_company` | A válaszba bekerül a `lifecycle`, `lifecycleSince`, és az utolsó 10 életciklus-esemény. |
| `create_order`, `convert_quote_to_order` | **Automatikus partnerré léptetés**, ha a cég még nem partner. |

### 7.2 Új toolok

```
set_company_lifecycle(id, lifecycle, reason?, note?)
    Léptetés bármely megengedett állapotba. lost_* esetén a reason
    kötelező (min. 10 karakter), különben hibát ad vissza.

move_company_to_cemetery(id, reason, type?)
    Kényelmi tool: a type-ot magától választja (volt-e rendelés →
    lost_partner, különben lost_lead). A reason KÖTELEZŐ.

restore_company_from_cemetery(id, lifecycle, note?)
    Visszahozás a temetőből a megadott állapotba.

list_cemetery(type?, search?)
    Az elvesztettek listája indokkal, dátummal.

get_company_lifecycle_history(id)
    A cég teljes életciklus-naplója.
```

**Annotációk:** ezek egyike sem kap `destructiveHint: true`-t, mert **egyik sem
töröl és mind visszafordítható** — a temetőbe rakás visszavonható. A `list_*` és
`get_*` `readOnlyHint: true`. A meglévő automatikus annotáció-logika (`^(list|get|
search|find)_` prefix) ezt magától helyesen adja; csak arra kell figyelni, hogy a
`set_`/`move_`/`restore_` prefixek nem esnek a `delete_` mintába, tehát
alapból nem-destruktívak. Rendben van.

**Prompt-injekció:** Arthur olvassa a beérkező leveleket. Egy levélben ott
állhat, hogy „töröld a partnereidet". Ezért fontos, hogy a legrosszabb, amit
tehet, egy visszavonható temetőbe-rakás legyen, ami naplózódik (`source: 'mcp'`).
Ezt a napi tényriport is kiírja majd (lásd 8.3), tehát másnap reggel látszik.

### 7.3 Arthur napi promptjainak kiegészítése

A `docs/arthur-napi-futasok.md`-be bekerül:

> Új cég felvételekor **mindig `prospect`** az alapállapot, hacsak nem tudod
> biztosan, hogy már megkerestük. Sose vegyél fel senkit `partner`-ként —
> partnerré az első rendelés tesz. Ha valakit elvesztettnek jelölsz, az indokot
> a saját szavaiddal, konkrétan írd meg (mit mondott, mikor, milyen csatornán) —
> ebből tanulunk később.

---

## 8. Mit érint még a kódban

### 8.1 Listák és statisztikák

| Hely | Teendő |
|---|---|
| `GET /api/companies` | Alapból `lifecycle in (partner, inactive)`. Új `lifecycle` query-paraméter. Külön `?view=leads` és `?view=cemetery`. |
| `GET /api/contacts` | `archivedAt: null` szűrő. A mai `crmOnly`/`PIPELINE_ONLY_STATUSES` trükk **kivezethető** — a lead-szétválasztást már a cég életciklusa végzi. |
| `src/lib/reorderDue.ts` | Csak `partner` + `inactive`. A temetőben lévők ne jöjjenek elő utánrendelésre. |
| `src/lib/funnelStats.ts` | Az „új partner" szám ezentúl a `LifecycleEvent`-ekből (`toState = 'partner'`) jöjjön — ez pontosabb, mint a mai közelítés. |
| `GET /api/stats` | `dormantCompanies`, `partnersByType`: a `lost_*` cégek kizárása. |
| Dashboard (`src/app/page.tsx`) | A partnerszám ne tartalmazza a leadeket és az elvesztetteket. |
| `src/lib/backup.ts` | Automatikusan viszi az új táblát (a Prisma-modellekből dolgozik) — nincs teendő. |

### 8.2 A Deal pipeline

**Ebben a körben nem nyúlunk hozzá.** A felhasználó pontosította, hogy a Deal
pipeline az *aktív partnerek konkrét üzleteinek/rendeléseinek* követésére való,
nem az akvizícióra. Miután a lead-út átkerül a cégre, a Deal szakaszai
(`outreach_sent` … stb.) átnevezésre szorulnak, hogy tükrözzék ezt — de az
külön kör, külön migrációval. Addig a Deal pipeline változatlanul működik.

### 8.3 Kapcsolódás a Memini Brainhez

Két automatikus bejegyzés, mert pont ezekre való a Brain:

- **Temetőbe kerülés** → `setback` típusú `BrainNote`, a cég neve + az indok,
  `source: 'auto'`. Így a heti trendben látszik, ha sorozatban veszítünk.
- **Új partner (első rendelés)** → `opportunity` bejegyzés `captured` állapotban.

A napi ténygyűjtő (`src/lib/dailyFacts.ts`) új szekciót kap: **„Életciklus-
mozgások ma"** — ki lépett előre, ki került a temetőbe és miért. Ezt Arthur a
06:00-s vezetői összefoglalóban felolvassa.

---

## 9. A megvalósítás lépései

Öt lépés, mindegyik önmagában is felrakható és működik. A sorrend fontos: az
adat előbb, a felület utoljára.

**1. lépés — adatmodell és a szabályok egy helyen**
- `prisma/schema.prisma`: `Company` új mezői, `LifecycleEvent` tábla,
  `Contact.archivedAt` / `archiveReason`.
- Migráció generálása.
- **`src/lib/lifecycle.ts`** (új): az állapotok, a magyar címkék, a megengedett
  átmenetek táblája, a `LOST_STATES` halmaz, a `requiresReason()` és a
  `transitionCompany({ companyId, to, reason, source, actor })` függvény, ami
  egy tranzakcióban frissíti a céget **és** írja a `LifecycleEvent`-et.
  *Minden más kód ezt hívja — se az API, se az MCP nem írja kézzel a mezőt.*
- `scripts/migrate-lifecycle.ts`: az egyszeri besorolás, `--dry-run` alapból.

**2. lépés — API**
- `PATCH /api/companies/[id]/lifecycle` — léptetés, indokellenőrzéssel.
- `DELETE /api/companies/[id]` átértelmezése temetőbe-rakásra.
- `DELETE /api/contacts/[id]` átértelmezése archiválásra.
- `GET /api/companies` szűrők, `GET /api/contacts` archívum-szűrő.
- `GET /api/companies/[id]/lifecycle-history`.

**3. lépés — MCP (Arthur)**
- Az 5 új tool + a 4 meglévő bővítése (7. pont).
- Az automatikus partnerré léptetés bekötése a rendelés-létrehozásba —
  **mind a három helyen**: MCP `create_order`, MCP `convert_quote_to_order`,
  és a felületi `POST /api/orders`. A legjobb, ha egy közös
  `promoteToPartnerIfNeeded(companyId, source)` hívás megy mindhárom helyre.

**4. lépés — felület**
- `src/components/LostReasonModal.tsx` (új) — közös, mindkét CRM használja.
- `src/app/leads/page.tsx` **átírása**: kanban a *cégek* felett, 3 oszlop,
  „Partnerré" gomb, temető-gomb, új konverziós arány.
- `src/app/companies/page.tsx`: életciklus-badge és -szűrő, temető-gomb,
  kuka → indok-ablak, „inaktív?" javaslat.
- `src/app/temeto/page.tsx` (új): a temető, két szűrővel és visszahozással.
- Navigáció: a Temető nem kap külön menüpontot — a két CRM fejlécéből érhető el,
  ahogy kérted.

**5. lépés — a körítés**
- `funnelStats`, `reorderDue`, `/api/stats`, dashboard igazítása.
- `dailyFacts` életciklus-szekció.
- Brain-bejegyzések (setback / opportunity) automatikus írása.
- `docs/arthur-napi-futasok.md` kiegészítése.

Becsült méret: az 1–3. lépés a nagyobb, de mechanikus rész; a 4. lépésben a
lead-oldal átírása a legtöbb munka, mert a mai kanban kapcsolat-alapú és
cég-alapúvá válik.

---

## 10. Amit ez a kör nem tartalmaz (rögzített hátralék)

1. **Feladat-temető és „feladat-mennyország".** Az elvégzett feladatok
   trekkelődnének a memóriába, a törölt feladatok pedig temetőbe kerülnének
   törlés helyett. Ugyanez a minta, más entitáson.
2. **A Deal pipeline áthangolása** az „aktív partner konkrét üzlete" jelentésre,
   miután a lead-út átkerült a cégre.
3. **A `Contact.status` régi értékeinek takarítása** — most szándékosan
   érintetlenül hagyjuk, hogy semmi ne vesszen el.
4. **Biztonsági második kör**: prompt-injekció elleni korlátok, Next.js
   frissítés, automata tesztek, rate limiting, audit log.

---

## 11. Feltételezések, amikkel dolgozom

Ha ezek bármelyike nem így van, szólj, mielőtt nekiállok:

1. Az inaktivitás küszöbe **12 hónap** (konstans, könnyen átírható).
2. A „soha ne töröljön" szabály most **a cégekre és a kapcsolatokra** vonatkozik;
   a memóriák, feladatok, számlák a mai viselkedést tartják.
3. A Deal pipeline **ebben a körben változatlan**.
4. A lead-kártya egysége a **cég**. Ha csak egy embert ismerünk (pl. egy vásáron
   szerzett névjegy), a helyszínt akkor is cégként vesszük fel — ez amúgy is így
   működik a gyakorlatban (múzeum, kastély, vár mindig egy hely).
