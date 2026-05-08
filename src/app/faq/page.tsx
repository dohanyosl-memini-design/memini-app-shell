'use client'

import { useState } from 'react'
import {
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  ShoppingCart,
  FileText,
  CheckSquare,
  Package,
  Euro,
  Wallet,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string
  a: string | React.ReactNode
  warning?: string
}

interface Module {
  id: string
  label: string
  icon: React.ElementType
  items: FaqItem[]
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const modules: Module[] = [
  {
    id: 'altalanos',
    label: 'Általános',
    icon: HelpCircle,
    items: [
      {
        q: 'Mi az a Memini Design rendszer?',
        a: 'A Memini Design egy magyar nyelvű, felhőalapú CRM és ERP rendszer, amelyet kifejezetten design- és kereskedelmi vállalkozások számára fejlesztettünk. Segít nyilvántartani a partnereket, ügyfeleket, megrendeléseket, számlákat, raktárkészletet, feladatokat és pénzügyeket – egyetlen helyen, böngészőből elérhetően.',
      },
      {
        q: 'Hogyan tudok bejelentkezni?',
        a: 'A rendszer a /login oldalon érhető el. Add meg az e-mail címed és jelszavadat, majd kattints a „Bejelentkezés" gombra. Ha elfelejtetted a jelszavadat, keresd az adminisztrátort. A munkamenet 30 napig aktív marad, ha nem jelentkezel ki kézzel.',
      },
      {
        q: 'Hogyan navigálhatok a rendszerben asztali gépen?',
        a: 'Asztali eszközön a bal oldalon található a sötét háttérszínű navigációs sáv (Sidebar). A menüpontok csoportokba rendezve jelennek meg: CRM (Ügyfelek, Cégek, Pipeline), Értékesítés (Megrendelések, Számlák), Raktár (Termékek & Készlet, Ártáblázat), Pénzügy (Cashflow, Riportok) és Egyéb (Feladatok). Kattints bármelyik menüpontra az adott modul megnyitásához.',
      },
      {
        q: 'Hogyan navigálhatok mobilon?',
        a: 'Mobilon a képernyő alján jelenik meg egy navigációs sáv a legfontosabb oldalakkal: Dashboard, Feladatok, Cégek, Számlák. A jobb szélső „Több" gombra koppintva megnyílik egy teljes menü-fiók (drawer), ahol az összes modul elérhető. A fiókot a jobb felső X gombbal, vagy a háttérre koppintással zárhatod be.',
      },
      {
        q: 'Automatikusan mentődnek az adatok?',
        a: 'Igen. Minden űrlap-beküldés (Mentés / Létrehozás gomb) azonnal elmenti az adatokat az adatbázisba. Nincs szükség külön „szinkronizálás" gombra. Ha bezárod az ablakot kitöltés közben, a még el nem mentett változtatások elveszhetnek – ezért mindig kattints a Mentés gombra mielőtt elhagyod az oldalt.',
        warning: 'Figyelem: a böngésző visszagombja vagy a lap bezárása mentetlen adatvesztést okozhat! Mindig mentsd el az űrlapot a kilépés előtt.',
      },
      {
        q: 'Hogyan kereshetek az oldalon belül?',
        a: 'Minden listaoldalon (Cégek, Ügyfelek, Megrendelések stb.) az oldal tetején található egy keresőmező. Gépelj bele és a lista valós időben szűrődik. A keresés a nevek, azonosítók és egyéb kulcsmezők alapján működik. A szűrőmező mellett általában státusz- és típusszűrők is elérhetők lenyíló listában.',
      },
      {
        q: 'Több felhasználó is használhatja egyszerre a rendszert?',
        a: 'Igen, a Memini Design többfelhasználós rendszer. Mindenki a saját fiókjával lép be. A feladatokat és megrendeléseket munkatársakhoz lehet rendelni. Jelenleg minden bejelentkezett felhasználónak azonos jogosultsága van – szerepkör-alapú jogosultságkezelés tervezett fejlesztés.',
      },
    ],
  },
  {
    id: 'cegek',
    label: 'Cégek',
    icon: Building2,
    items: [
      {
        q: 'Hogyan vehetek fel új céget?',
        a: 'Nyisd meg a Cégek modult a bal oldali menüből, majd kattints az „+ Új cég" gombra. Az egyetlen kötelező mező a cég neve. A többi mező (cím, kapcsolattartó, partner típus, besorolás stb.) opcionális, de javasolt kitölteni a hatékonyabb munkavégzéshez. Mentés után a cég megjelenik a listában.',
      },
      {
        q: 'Mit jelentenek a partner típusok (Endkunde / Distributor / Einzelhandel)?',
        a: (
          <span>
            A partner típus megmutatja, hogy a cég milyen szerepet tölt be az értékesítési láncban:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Endkunde</strong> – végfelhasználó, közvetlenül tőlünk vásárol, nem értékesít tovább.</li>
              <li><strong>Distributor</strong> – nagykereskedő, aki más kereskedőknek adja el a terméket.</li>
              <li><strong>Einzelhandel</strong> – kiskereskedő, aki végfelhasználóknak értékesít boltban vagy webshopban.</li>
            </ul>
            <span className="block mt-2">A típus hatással lehet az árazásra és a riportokra.</span>
          </span>
        ),
      },
      {
        q: 'Mit jelent az A-D besorolás?',
        a: (
          <span>
            Az ABC-D besorolás a partner értékét és aktivitását jelzi:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>A – Kiemelt partner:</strong> rendszeresen vásárol, nagy forgalmat generál, prioritást élvez.</li>
              <li><strong>B – Rendszeres partner:</strong> stabil, közepes forgalmú ügyfél.</li>
              <li><strong>C – Alkalmi partner:</strong> ritkán vásárol, alacsonyabb prioritású.</li>
              <li><strong>D – Inaktív / Potenciális partner:</strong> még nem vásárolt, vagy hosszú ideje nem rendelt. Ide kerülnek az új cégek is alapértelmezetten.</li>
            </ul>
          </span>
        ),
        warning: 'A Dashboard „Szunnyadó partnerek" figyelmeztetése automatikusan kiemeli azokat a cégeket, amelyek több mint 90 napja nem rendeltek – érdemes ezeket rendszeresen ellenőrizni.',
      },
      {
        q: 'Mit jelent a csatorna mező a cégnél?',
        a: 'A csatorna mező azt rögzíti, hogy honnan szereztük a partnert: pl. hideg keresés, ajánlás, vásár/kiállítás, weboldalon keresztül, közösségi média stb. Ez segít mérni, hogy melyik megszerzési csatorna a leghatékonyabb.',
      },
      {
        q: 'Hogyan láthatom a céghez rendelt összes adatot?',
        a: 'Kattints a cég nevére a listában a részletes nézet megnyitásához. A cég adatlapján külön füleken találod: a kapcsolódó Kontaktokat (ügyfelek), a Megrendeléseket, a Számlákat és a Feladatokat. Így egyetlen oldalon áttekintheted az adott partnerrel kapcsolatos összes tevékenységet.',
      },
      {
        q: 'Lehet egy cégnek több kapcsolattartója?',
        a: 'Igen, egy céghez korlátlan számú kontakt rendelhető. A cég adatlapján a „Kontaktok" fülön látod az összes kapcsolódó személyt, és közvetlenül innen is felvehet új kontaktot az adott céghez.',
      },
      {
        q: 'Hogyan törölhetek vagy szerkeszthetek egy céget?',
        a: 'A cég listában kattints a sor végén lévő szerkesztés (ceruza) ikonra, vagy nyisd meg a cég adatlapját és kattints a „Szerkesztés" gombra. Törlés esetén megjelenik egy megerősítő ablak. Figyelem: a törlés végleges, és az összes kapcsolódó adat (megrendelések, számlák) is törlésre kerülhet.',
        warning: 'Céget csak akkor törölj, ha biztosan nincs rá szükség. A törlés visszavonhatatlan és az összes hozzárendelt adat elveszhet.',
      },
    ],
  },
  {
    id: 'ugyfelek',
    label: 'Ügyfelek',
    icon: Users,
    items: [
      {
        q: 'Mi a különbség az „Ügyfél" és a „Cég" között?',
        a: 'Az „Ügyfél" (kontakt) egy konkrét személy – pl. a partner cég képviselője, vásárlója. A „Cég" a szervezet maga. Egy cégnek több ügyfelje (kontaktja) is lehet. A rendszerben személyek és cégek külön kezelhetők, de összekapcsolhatók.',
      },
      {
        q: 'Hogyan veszek fel új ügyfelet (kontaktot)?',
        a: 'Nyisd meg az Ügyfelek modult, kattints az „+ Új ügyfél" gombra. Add meg a keresztnevet és a vezetéknevet (mindkettő kötelező). Opcionálisan megadhatod: e-mail, telefon, pozíció, kapcsolódó cég, státusz és megjegyzések. Mentés után az ügyfél megjelenik a listában.',
      },
      {
        q: 'Hogyan kapcsolom össze az ügyfelet egy céggel?',
        a: 'Az ügyfél szerkesztési űrlapján találsz egy „Cég" legördülő mezőt. Kezdj el gépelni a cég nevét, és a rendszer automatikusan felajánlja a találatokat. Válaszd ki a megfelelő céget, majd mentsd el az ügyfelet. Az összekapcsolt ügyfél ezután megjelenik a cég adatlapján is.',
      },
      {
        q: 'Mit jelentenek az ügyfél állapot mezők?',
        a: (
          <span>
            Az állapot mező az ügyfél értékesítési cikluson belüli helyzetét mutatja:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Lead:</strong> potenciális ügyfél, akivel még nem vettük fel a kapcsolatot.</li>
              <li><strong>Megkeresve:</strong> kapcsolatba léptünk, de még nem tudtuk, érdekelt-e.</li>
              <li><strong>Egyeztetés alatt:</strong> aktív tárgyalás folyik.</li>
              <li><strong>Ajánlat elküldve:</strong> árajánlatot kapott.</li>
              <li><strong>Aktív partner:</strong> rendszeresen vásárol, aktív ügyfél.</li>
              <li><strong>Inaktív:</strong> korábbi ügyfél, jelenleg nem vásárol.</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Mit találok az ügyfél „Feladatok" fülén?',
        a: 'Az ügyfél adatlapján a „Feladatok" fül listázza az adott személyhez rendelt összes feladatot – például tervezett hívás, e-mail, személyes találkozó. Innen új feladatot is felvehetsz közvetlenül az ügyfélhez rendelve, anélkül hogy a Feladatok modulba kellene navigálni.',
      },
      {
        q: 'Mit találok az ügyfél „Kommunikáció" fülén?',
        a: 'A „Kommunikáció" fül rögzíti a korábbi érintkezési pontokat: telefonhívások, e-mailek, személyes találkozók és egyéb kontaktusok. A napló segít nyomon követni, ki mikor lépett kapcsolatba az ügyféllel, és miről volt szó.',
      },
    ],
  },
  {
    id: 'pipeline',
    label: 'Lead Pipeline',
    icon: TrendingUp,
    items: [
      {
        q: 'Mi az a Lead Pipeline?',
        a: 'A Lead Pipeline (vagy „deals") az értékesítési folyamatot vizualizálja Kanban-táblás formában. Minden oszlop egy értékesítési fázist jelképez, és a kontaktokat (dealeket) ezeken az oszlopokon kell végigvezetni a hideg leadtől az aktív partnerig.',
      },
      {
        q: 'Milyen fázisok vannak a pipelineben?',
        a: (
          <span>
            A pipeline az alábbi fázisokból áll, sorrendben:
            <ol className="mt-2 space-y-1 list-decimal list-inside text-gray-600">
              <li><strong>Hideg lead:</strong> még nem lépett velünk kapcsolatba, de potenciális ügyfél.</li>
              <li><strong>Megkeresve:</strong> felvettük a kapcsolatot, várjuk a visszajelzést.</li>
              <li><strong>Egyeztetés:</strong> aktív tárgyalás folyik, felmérjük az igényeit.</li>
              <li><strong>Ajánlat elküldve:</strong> árajánlatot kapott, döntés várható.</li>
              <li><strong>Aktív partner:</strong> megkötöttük az üzletet, rendszeres vásárló lett.</li>
            </ol>
            <span className="block mt-2">Emellett „Elveszett" fázis is létezik azoknak, akik nem váltak ügyféllé.</span>
          </span>
        ),
      },
      {
        q: 'Hogyan változtathatok fázist egy dealen?',
        a: 'Kétféleképpen lehet fázist változtatni: (1) Húzd a deal kártyáját egyik oszlopból a másikba (drag-and-drop). (2) Nyisd meg a deal részleteit kattintással, és a legördülő „Fázis" mezőben válts a kívánt állapotra, majd mentsd el.',
      },
      {
        q: 'Hogyan tudok új dealt (leadet) felvenni?',
        a: 'A Pipeline oldalon kattints az „+ Új deal" gombra vagy a kívánt oszlop tetején lévő plusz ikonra. Az űrlapban add meg a deal nevét, rendeld hozzá a kontakthoz vagy céghez, adj meg egy becsült értéket (euróban) és egy várható zárási dátumot. Mentés után a deal megjelenik a megadott fázis oszlopában.',
      },
      {
        q: 'Hogyan működik a drag-and-drop mozgatás?',
        a: 'Tartsd lenyomva a deal kártyáját, majd húzd a kívánt fázis oszlopába, végül engedd fel. A rendszer automatikusan frissíti a fázist és elmenti az adatbázisba. Mobilon a fogd és húzd funkció támogatott, de érintőképernyőn néha kényelmesebb a kattintásos fázisváltás.',
      },
      {
        q: 'Hogyan látom a pipeline összesített értékét?',
        a: 'A Dashboard főoldalán a „Pipeline értéke" KPI kártya mutatja az összes aktív (le nem zárt) deal becsült összértékét euróban. A Pipeline oldalon az egyes oszlopok fejlécénél is látható a fázisba tartozó dealek száma és összértéke.',
      },
      {
        q: 'Mi történik, ha egy deal „Elveszett" lesz?',
        a: 'Az elveszett dealek kikerülnek az aktív pipeline nézetből, de nem törlődnek. A riportokban és a Dashboard pipeline grafikonon „Elveszett" kategóriaként jelennek meg. Az elveszett deal okát érdemes megjegyzetként rögzíteni a deal adatlapján a tanulságok megőrzése érdekében.',
      },
    ],
  },
  {
    id: 'megrendelesek',
    label: 'Megrendelések',
    icon: ShoppingCart,
    items: [
      {
        q: 'Hogyan hozok létre új megrendelést?',
        a: 'Nyisd meg a Megrendelések modult, kattints az „+ Új megrendelés" gombra. Első lépésként kötelező kiválasztani a partnercéget – e nélkül nem folytatható a megrendelés. Ezután add meg a megrendelés dátumát, szállítási módot, majd add hozzá a termékeket.',
        warning: 'A partnercég kiválasztása kötelező és a megrendelés létrehozása után nem módosítható. Ellenőrizd kétszer, hogy a megfelelő céget választottad-e!',
      },
      {
        q: 'Hogyan adok hozzá terméket a megrendeléshez?',
        a: (
          <span>
            A megrendelés szerkesztőjében kattints a „+ Termék hozzáadása" gombra. A termékválasztó listában az alábbi jelzések segítenek:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>⭐ csillag ikon:</strong> ezt a terméket korábban már rendelte ez a partner – valószínűleg ismét szüksége van rá.</li>
              <li><strong>📍 helyszín ikon:</strong> ez a termék az adott városhoz / régióhoz illő, helyi szempontból releváns.</li>
            </ul>
            <span className="block mt-2">Add meg a kívánt darabszámot, és az egységár automatikusan frissül a tier árazás szerint.</span>
          </span>
        ),
      },
      {
        q: 'Mi az a tier árazás és hogyan működik a megrendelésnél?',
        a: 'A tier árazás mennyiségtől függő kedvezményrendszer. Minél több darabot rendel egy partner, annál alacsonyabb az egységár. Amikor megadod a darabszámot a megrendelésben, a rendszer automatikusan kikeresi a termékhez rendelt árlistából a megfelelő árkategóriát, és frissíti az egységárat. Az összesített végösszeget is automatikusan újraszámítja.',
      },
      {
        q: 'Milyen státuszai vannak egy megrendelésnek?',
        a: (
          <span>
            A megrendelések az alábbi állapotokon mennek végig sorrendben:
            <ol className="mt-2 space-y-1 list-decimal list-inside text-gray-600">
              <li><strong>Függőben:</strong> a megrendelés rögzítve van, de még nincs visszaigazolva.</li>
              <li><strong>Visszaigazolva:</strong> a partner visszaigazolta, gyártás / készlet foglalás indulhat.</li>
              <li><strong>Gyártásban:</strong> a termék gyártás vagy összekészítés alatt áll.</li>
              <li><strong>Kiszállítva:</strong> a csomag útban van a partner felé.</li>
              <li><strong>Átadva:</strong> a partner megkapta az árut, a megrendelés lezárult.</li>
            </ol>
          </span>
        ),
      },
      {
        q: 'Hogyan nyomtatom ki a megrendelőlapot a raktárosnak?',
        a: 'A megrendelés adatlapján kattints a „Nyomtatás" gombra. Egy új böngészőfülön megnyílik az A4-es méretű, nyomtatásra optimalizált megrendelőlap, amelyen szerepel a partner adatai, a rendelt termékek listája, mennyiségek és a szállítási információk. A böngésző nyomtatás funkciójával (Ctrl+P / Cmd+P) küldhető a nyomtatóra.',
      },
      {
        q: 'Hogyan generálok számlát egy megrendelésből?',
        a: 'A megrendelés adatlapján kattints a „Számla generálása" gombra. A rendszer automatikusan létrehozza a számlát a megrendelés adataival (partner, termékek, összegek). Az így létrehozott számla megjelenik a Számlák modulban, ahol tovább szerkeszthető (pl. fizetési határidő beállítása).',
      },
      {
        q: 'Hogyan ismételhetek meg egy megrendelést?',
        a: 'Ha egy partner ugyanolyan vagy hasonló összetételű megrendelést ad le, mint korábban, a megrendelés adatlapján kattints a „Megismétlés" gombra. A rendszer létrehoz egy új, azonos tartalmú megrendelést „Függőben" státusszal, amit ezután szerkeszthetsz (dátum, mennyiség stb.) mielőtt véglegesítsd.',
      },
      {
        q: 'Milyen szállítási módok érhetők el?',
        a: 'A megrendelés szerkesztőjében a „Szállítási mód" legördülőből választhatsz: például futárszolgálat, személyes átvétel, saját szállítás. A kiválasztott szállítási mód megjelenik a megrendelőlapon is.',
      },
    ],
  },
  {
    id: 'szamlak',
    label: 'Számlák',
    icon: FileText,
    items: [
      {
        q: 'Hogyan hozok létre számlát?',
        a: 'Számlát kétféleképpen lehet létrehozni: (1) Megrendelésből: a megrendelés adatlapján kattints a „Számla generálása" gombra – ez automatikusan kitölti a számla adatait. (2) Manuálisan: a Számlák modulban kattints az „+ Új számla" gombra, és töltsd ki kézzel a mezőket (partner, tételek, összeg).',
      },
      {
        q: 'Hogyan állítom be a fizetési határidőt?',
        a: 'A számla szerkesztőjében a „Fizetési határidő" mezőnél találsz gyors előbeállítás gombokat: 7 nap, 14 nap és 30 nap. Ezek megnyomásával automatikusan kiszámítja a rendszer a határidő dátumát a számlakiállítás napjától. Természetesen kézzel is megadhatsz bármilyen dátumot.',
      },
      {
        q: 'Milyen státuszai vannak a számlának?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Nyitott:</strong> a számla kiküldve, fizetés még nem érkezett be.</li>
              <li><strong>Befizetve:</strong> a partner megfizette a számlát.</li>
              <li><strong>Lejárt:</strong> a fizetési határidő elmúlt, de a számla még nincs kifizetve.</li>
              <li><strong>Stornó:</strong> a számlát érvénytelenítettük, stornó számla készült hozzá.</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Mit tegyek, ha egy számla státuszát „Befizetve"-re kell állítani?',
        a: 'Nyisd meg a számla adatlapját, kattints a „Státusz módosítása" gombra (vagy a legördülőre), és válaszd a „Befizetve" állapotot. Opcionálisan rögzítheted a befizetés dátumát és az utalás referenciaszámát is.',
      },
      {
        q: 'Hogyan készíthetek stornó számlát?',
        a: 'Stornózni csak „Nyitott" státuszú számlát lehet. A számla adatlapján kattints a „Stornó számla készítése" gombra. A rendszer automatikusan létrehoz egy negatív összegű stornó számlát, és az eredeti számla státusza „Stornó"-ra vált. A stornó számla szintén megjelenik a Számlák listában és letölthető / nyomtatható.',
        warning: 'A stornózás visszavonhatatlan művelet! Az eredeti számla véglegesen „Stornó" státuszba kerül.',
      },
      {
        q: 'Hogyan jelennek meg a lejárt számlák?',
        a: 'A lejárt számlák piros színnel kiemelve szerepelnek a Számlák listában. Emellett a Dashboard főoldalon megjelenik egy piros figyelmeztetés a lejárt számlák számával. A rendszer automatikusan feladatot is generál a lejárt számlákhoz, amely megjelenik a Feladatok modulban, hogy ne maradjon figyelmen kívül.',
      },
      {
        q: 'Hogyan tudom letölteni vagy elküldeni a számlát?',
        a: 'A számla adatlapján kattints a „Letöltés PDF" gombra az A4-es formátumú, nyomtatásra és e-mail csatolásra alkalmas PDF generálásához. Közvetlen e-mail küldés a rendszerből egyelőre nem elérhető, de a letöltött PDF csatolható bármilyen levelezőrendszerből.',
      },
    ],
  },
  {
    id: 'feladatok',
    label: 'Feladatok',
    icon: CheckSquare,
    items: [
      {
        q: 'Milyen típusú feladatokat hozhatok létre?',
        a: (
          <span>
            A feladat típusa megmutatja, milyen tevékenységről van szó:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Hívás:</strong> telefonos megkeresés egy ügyféllel vagy partnerrel.</li>
              <li><strong>E-mail:</strong> írásos kommunikáció elektronikus úton.</li>
              <li><strong>Személyes találkozó:</strong> tárgyalás, meeting helyszínen vagy videóhíváson.</li>
              <li><strong>Ajánlatírás:</strong> árajánlat elkészítése és elküldése.</li>
              <li><strong>Számlaírás:</strong> számla készítése és kiküldése.</li>
              <li><strong>Adminisztráció:</strong> belső adminisztratív feladat, dokumentumkezelés.</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Hogyan állítom be a feladat prioritását?',
        a: (
          <span>
            Három prioritási szint érhető el:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Magas 🔴:</strong> azonnali figyelmet igénylő, sürgős feladatok.</li>
              <li><strong>Közepes 🟡:</strong> fontos, de nem feltétlenül azonnali teendők.</li>
              <li><strong>Alacsony ⚪:</strong> ráérő, kevésbé kritikus feladatok.</li>
            </ul>
            <span className="block mt-2">A Dashboard „Közelgő feladatok" listája prioritás szerint rendezi a megjelenítést.</span>
          </span>
        ),
      },
      {
        q: 'Hogyan rendelek feladatot munkatárshoz?',
        a: 'Az új feladat vagy szerkesztési űrlap „Felelős" legördülő mezőjéből válaszd ki a megfelelő munkatársat. A hozzárendelt feladatok megjelennek az illető saját feladatlistájában. Ha a felelőst nem adod meg, a feladat „Nem hozzárendelt" marad.',
      },
      {
        q: 'Mi az a részfeladat (subtask) és hogyan hozok létre?',
        a: 'A részfeladatok lehetővé teszik, hogy egy nagyobb feladatot kisebb, elvégezhető lépésekre bonts. A feladat adatlapján görgess le a „Részfeladatok" szekciókhoz, kattints a „+ Részfeladat hozzáadása" gombra, írd be a lépést, majd mentsd. Minden részfeladatnál jelölhető, ha elvégezted. A főfeladat csak akkor tekinthető teljesítettnek, ha minden részfeladat kész.',
      },
      {
        q: 'Hogyan működik a Kanban nézet a Feladatoknál?',
        a: 'A Feladatok modul táblás (Kanban) nézetben is megjeleníthető. Az oszlopok a feladatok állapotát jelölik: „Tennivaló", „Folyamatban", „Elvégezve". A feladatkártyákat fogd és húzd módszerrel mozgathatod az oszlopok között, és az állapot azonnal frissül. A kártyákon látható a prioritás, határidő és a hozzárendelt munkatárs.',
      },
      {
        q: 'Mik azok az automatikus feladatok és honnan jönnek?',
        a: 'Bizonyos rendszeresemények automatikus feladatokat hoznak létre, amelyek megjelennek a Feladatok listában. Például: ha egy számla lejár fizetési határidő nélkül, a rendszer automatikusan létrehoz egy „Lejárt számla követése" típusú feladatot, hozzárendelve az érintett ügyfélhez. Ezeket az automatikus feladatokat az ikont és a „[Auto]" előtagot keresd.',
        warning: 'Az automatikus feladatokat ne töröld figyelmetlenül – ezek fontos emlékeztetők lehetnek lejárt számlákról vagy egyéb kritikus eseményekről.',
      },
      {
        q: 'Hogyan jelölök egy feladatot elvégzettnek?',
        a: 'A feladatlistában kattints a feladat neve melletti jelölőnégyzetre (checkbox), vagy nyisd meg a feladatot és változtasd az állapotát „Elvégezve"-re. Az elvégzett feladatok halvány szürke színnel jelennek meg, és alapértelmezés szerint el vannak rejtve a listából – a „Befejezve mutatása" kapcsolóval tekinthetők meg.',
      },
    ],
  },
  {
    id: 'raktar',
    label: 'Raktár',
    icon: Package,
    items: [
      {
        q: 'Hogyan veszek fel új terméket a raktárba?',
        a: 'Nyisd meg a Raktár modult, kattints az „+ Új termék" gombra. Kötelező mező: a termék neve és az SKU (raktári azonosítókód). Az SKU egyedinek kell lennie a rendszerben – ha már létező SKU-t adsz meg, hibaüzenetet kapsz. Opcionálisan megadható: leírás, alapár, minimális készletszint, raktárhely és termékfotó.',
        warning: 'Az SKU kód kötelező és egyedi – kétszer ellenőrizd a kódot mielőtt mentesz, mert a duplikált SKU hibát okoz.',
      },
      {
        q: 'Hogyan rögzíthetek készletmozgást?',
        a: (
          <span>
            A termék adatlapján vagy a raktári listán a „Készletmozgás" gombra kattintva háromféle mozgást rögzíthetsz:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>Bevét:</strong> készlet növelése (pl. szállítmány érkezett).</li>
              <li><strong>Kivét:</strong> készlet csökkentése (pl. kiszállítás, selejtezés).</li>
              <li><strong>Korrekció:</strong> a készlet egy konkrét értékre állítása (pl. leltár után).</li>
            </ul>
            <span className="block mt-2">Minden mozgásnál megadható a dátum és egy megjegyzés az ok rögzítéséhez.</span>
          </span>
        ),
      },
      {
        q: 'Hogyan működik a minimális készlet figyelmeztetés?',
        a: 'Ha egy termékhez be van állítva minimális készletszint, és az aktuális készlet ez alá csökken, a termék piros jelzéssel jelenik meg a raktári listán. A Dashboard főoldalon szintén megjelenik egy figyelmeztetés az alacsony készletű termékek SKU-jával.',
        warning: 'Az alacsony készletszintű termékeket haladéktalanul rendelje meg újra – a piros jelzés kritikus készlethelyzetet jelez!',
      },
      {
        q: 'Mi az a raktárhely és hogyan tudom beállítani?',
        a: 'A raktárhely (szekrény / polc / doboz) lehetővé teszi a fizikai raktár pontos nyilvántartását. A termék szerkesztőjében megadható a raktárhely kódja, pl. „A-polc / 3. rekesz". Ez megjelenik a megrendelőlapon is, segítve a raktáros munkáját.',
      },
      {
        q: 'Hogyan tölthetek fel termékfotót?',
        a: 'A termék szerkesztőjében görgess a „Termékfotó" szekcióhoz. Asztali gépen kattints a feltöltés gombra és válaszd ki a képfájlt (JPG, PNG, WebP). Mobilon közvetlenül lefotózhatod a terméket a kamera gombra koppintva. A feltöltött kép miniatűrként jelenik meg a raktárlistában.',
      },
      {
        q: 'Hogyan kapcsolom össze a terméket egy árlistával?',
        a: 'A termék szerkesztőjében görgess az „Árlista" szekcióhoz, és a legördülőből válaszd ki a hozzárendelni kívánt árlistát. Ezután a termékre vonatkozó tier árazás érvényesül a megrendelésekben. Egy termékhez egyszerre egy árlista rendelhető.',
      },
    ],
  },
  {
    id: 'artablazat',
    label: 'Ártáblázat',
    icon: Euro,
    items: [
      {
        q: 'Mi az a tier árazás?',
        a: 'A tier (szintezett) árazás egy mennyiségtől függő kedvezményrendszer. Alap logikája: minél több terméket rendel a partner egyszerre, annál kisebb az egységár. Az árlistában meghatározható, hogy melyik mennyiségi sávhoz milyen szorzó tartozik – a rendszer automatikusan alkalmazza a megrendelésben.',
      },
      {
        q: 'Hogyan működnek a mennyiségi szorzók?',
        a: (
          <span>
            Egy tipikus tier árazási példa:
            <div className="mt-2 overflow-x-auto">
              <table className="text-sm text-gray-600 border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold">Mennyiség (db)</th>
                    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold">Szorzó</th>
                    <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold">Hatás (alap ár 100€)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-1.5">1–49 db</td>
                    <td className="border border-gray-200 px-3 py-1.5">1.0×</td>
                    <td className="border border-gray-200 px-3 py-1.5">100€/db</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-1.5">50–99 db</td>
                    <td className="border border-gray-200 px-3 py-1.5">0.9×</td>
                    <td className="border border-gray-200 px-3 py-1.5">90€/db</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-1.5">100+ db</td>
                    <td className="border border-gray-200 px-3 py-1.5">0.8×</td>
                    <td className="border border-gray-200 px-3 py-1.5">80€/db</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <span className="block mt-2">Az egységár = alap ár × szorzó. A megrendelőben a rendszer automatikusan kikeresi a megfelelő sort a megadott darabszám alapján.</span>
          </span>
        ),
      },
      {
        q: 'Hogyan hozok létre új árlistát?',
        a: 'Az Ártáblázat modulban kattints az „+ Új árlista" gombra. Add meg az árlista nevét (pl. „Standard 2024"), majd add hozzá a mennyiségi sávokat: mindegyik sorban megadod az alsó és felső mennyiségi határt, és a szorzót. A sávokat egymás alá sorolhatod, és a rendszer automatikusan növekvő sorrendbe rendezi.',
      },
      {
        q: 'Hogyan rendelem hozzá az árlistát egy termékhez?',
        a: 'Menj a Raktár modulba, nyisd meg a szerkeszteni kívánt terméket, görgess az „Árlista" mezőhöz, és a legördülőből válaszd ki az árlistát. Mentés után a termékre automatikusan érvényes lesz a kiválasztott tier árazás a következő megrendelésektől.',
      },
      {
        q: 'Mi történik, ha nem rendelt árlistát egy termékhez?',
        a: 'Ha a termékhez nincs árlista rendelve, a megrendelésben az alap eladási ár (salesPrice) kerül alkalmazásra, mennyiségi kedvezmény nélkül. Ilyenkor a tier szorzó automatikusan 1.0× lesz, tehát a kézi alapárat alkalmazza a rendszer.',
      },
      {
        q: 'Módosíthatom az árlistát már meglévő megrendeléseken?',
        a: 'Nem. Az árlista változtatása csak az új megrendelésekre érvényes. A már létező megrendelések rögzített egységárral tárolódnak, és az árlista módosítása nem módosítja visszamenőleg a meglévő tételeket.',
        warning: 'Az árlista módosítása csak jövőbeli megrendelésekre hat. Meglévő megrendelések egységárát nem érinti.',
      },
    ],
  },
  {
    id: 'konyveies',
    label: 'Könyvelés',
    icon: Wallet,
    items: [
      {
        q: 'Hogyan rögzítek egy kiadást?',
        a: 'Nyisd meg a Pénzügy / Cashflow modult, kattints az „+ Új tranzakció" gombra, válaszd a „Kiadás" típust. Add meg az összeget, a dátumot, a kategóriát (pl. szállítás, marketing, bérleti díj) és egy leírást. Opcionálisan csatolhatsz számlabizonylatot is.',
      },
      {
        q: 'Hogyan tudom lefotózni vagy feltölteni a számlabizonylatomat?',
        a: 'A tranzakció szerkesztőjében görgess a „Bizonylat" szekcióhoz. Mobilon a kamera ikonra koppintva közvetlenül lefotózhatod a papíralapú számlát. Asztali gépen a fájl feltöltés gombra kattintva tallózhatsz JPG, PNG vagy PDF fájlok közül.',
      },
      {
        q: 'Mi az az OCR és hogyan segít?',
        a: 'Az OCR (optikai karakterfelismerés) automatikusan kinyeri a szövegezést a feltöltött számlaképből. A rendszer megpróbálja azonosítani az összeget, a dátumot és a szállítót, és előtölti ezeket a mezőket. Az automatikusan kitöltött adatokat mindig ellenőrizd és szükség esetén javítsd manuálisan.',
        warning: 'Az OCR nem mindig 100%-os pontosságú, különösen kézzel írott vagy rossz minőségű képek esetén. Minden feltöltés után ellenőrizd a kinyert adatokat!',
      },
      {
        q: 'Hogyan nézhetem meg a havi kimutatást?',
        a: 'A Cashflow oldalon felül látható a havi összesítő: bevételek, kiadások és az egyenleg (bevétel mínusz kiadás). A Dashboard főoldalán a cashflow grafikon az elmúlt 6 hónap bevétel-kiadás arányát mutatja vizuálisan területdiagram formájában.',
      },
      {
        q: 'Hogyan állíthatok be visszatérő költséget?',
        a: 'A „+ Új tranzakció" vagy a tranzakció szerkesztőjénél jelöld be az „Visszatérő" opciót. Add meg az ismétlési frekvenciát: havi, negyedéves vagy éves. A rendszer automatikusan létrehozza a tranzakciót a megadott időközönként. Ez hasznos SaaS előfizetések, bérleti díjak és egyéb rendszeres kiadások nyilvántartásához.',
      },
      {
        q: 'A könyvelési adatok exportálhatók?',
        a: 'A Riportok modulban exportálhatod a tranzakciókat Excel-kompatibilis CSV formátumban. A letöltött fájl tartalmazza az összes tranzakció adatát (dátum, típus, összeg, kategória, leírás), amelyet könyvelőprogramba importálhatsz.',
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      {
        q: 'Mit mutat a Dashboard főoldal?',
        a: (
          <span>
            A Dashboard a legfontosabb üzleti mutatókat jeleníti meg egy oldalon:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              <li><strong>KPI kártyák:</strong> nyitott számlák összege, havi bevétel/kiadás, pipeline értéke, ügyfelek száma, nyitott feladatok.</li>
              <li><strong>Figyelmeztetések:</strong> lejárt számlák, alacsony raktárkészlet, szunnyadó partnerek.</li>
              <li><strong>Cashflow grafikon:</strong> az utolsó 6 hónap bevétel-kiadás trendje.</li>
              <li><strong>Közelgő feladatok:</strong> a legsürgősebb teendők listája.</li>
              <li><strong>Sales pipeline:</strong> az aktív dealek fázis szerinti megoszlása.</li>
              <li><strong>Termék készletek:</strong> a kiemelt termékek aktuális készletszintje.</li>
              <li><strong>Partner besorolás és típus:</strong> A-D besorolás és partner típus szerinti megoszlás.</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Hogyan frissülnek a Dashboard adatai?',
        a: 'A Dashboard adatai minden oldalbetöltéskor frissülnek az adatbázisból. Nincs automatikus háttérfrissítés – ha friss adatot szeretnél látni, töltsd újra az oldalt (F5 vagy az újratöltés gomb). Tervezett fejlesztés a valós idejű, automatikus frissítés.',
      },
      {
        q: 'Mit jelent a „Szunnyadó partner" figyelmeztetés?',
        a: 'Ha egy partnercég több mint 90 napja nem adott le megrendelést, „szunnyadó partnernek" minősül. A Dashboard figyelmeztetés névszerint felsorolja ezeket a cégeket, hogy időben felvehesd velük a kapcsolatot és ne veszítsd el az ügyfelet.',
      },
      {
        q: 'Mit jelent az „Alacsony készlet" figyelmeztetés?',
        a: 'Ha egy termék aktuális készlete a beállított minimális készletszint alá esik, a Dashboard narancssárga figyelmeztetéssel jelzi az érintett termékek SKU-kódját. Ez azonnali utánrendelési szükségletet jelez.',
      },
      {
        q: 'Melyik KPI kártya mire utal?',
        a: (
          <span>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li><strong>Nyitott számlák:</strong> az összes ki nem fizetett számla euróban összegzett értéke, és darabszáma. Ha van lejárt számla, piros jelzéssel jelenik meg.</li>
              <li><strong>Havi bevétel:</strong> az aktuális hónap összes beérkezett fizetése.</li>
              <li><strong>Havi kiadás:</strong> az aktuális hónap összes rögzített kiadása, plusz az egyenleg (bevétel–kiadás).</li>
              <li><strong>Pipeline értéke:</strong> az összes aktív (le nem zárt) deal becsült értékének összege.</li>
              <li><strong>Ügyfelek:</strong> az összes kontakt száma, és a partner cégek száma.</li>
              <li><strong>Nyitott feladatok:</strong> az elvégzetlen feladatok száma.</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Személyre szabható a Dashboard?',
        a: 'Jelenleg a Dashboard kiosztása rögzített és mindenki számára azonos. A jövőben tervezzük a widgetek személyre szabhatóságát (áthelyezés, elrejtés, egyéni szűrők). Ha van egyedi igényed, jelezd az adminisztrátornak.',
      },
    ],
  },
]

// ─── Accordion item ────────────────────────────────────────────────────────────

function AccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-start gap-3 flex-1 min-w-0">
          <span className="mt-0.5 text-blue-500 shrink-0 font-bold text-sm w-5 text-right">
            {index + 1}.
          </span>
          <span className="font-medium text-gray-900 text-sm leading-snug">{item.q}</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 mt-0.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 bg-white border-t border-gray-100">
          <div className="pl-8 text-gray-600 text-sm leading-relaxed">
            {item.a}
          </div>
          {item.warning && (
            <div className="mt-3 ml-8 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-800 text-xs leading-relaxed">{item.warning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function FaqPage() {
  const [activeId, setActiveId] = useState(modules[0].id)

  const activeModule = modules.find((m) => m.id === activeId) ?? modules[0]

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <HelpCircle size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Súgó és GYIK</h1>
              <p className="text-gray-500 text-sm">Memini Design – Részletes felhasználói útmutató</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Mobile: horizontal scrollable tab bar */}
        <div className="md:hidden border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto scrollbar-none px-4 gap-1 py-2">
            {modules.map((m) => {
              const Icon = m.icon
              const isActive = m.id === activeId
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveId(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={13} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-52 lg:w-60 shrink-0 flex-col bg-gray-50 border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-0">
            <nav className="p-3 space-y-0.5">
              {modules.map((m) => {
                const Icon = m.icon
                const isActive = m.id === activeId
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveId(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400'} />
                    <span>{m.label}</span>
                    {isActive && (
                      <span className="ml-auto bg-white/20 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {m.items.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto p-4 border-t border-gray-200">
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Memini Design<br />
                Vállalatirányítás
              </p>
            </div>
          </aside>

          {/* Content area */}
          <main className="flex-1 min-w-0 p-4 md:p-8">
            {/* Module header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <activeModule.icon size={16} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{activeModule.label}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                  {activeModule.items.length} kérdés
                </span>
              </div>
              <p className="text-sm text-gray-500 pl-11">
                Kattints egy kérdésre a részletes válasz megtekintéséhez.
              </p>
            </div>

            {/* Accordion list */}
            <div className="space-y-2">
              {activeModule.items.map((item, i) => (
                <AccordionItem key={i} item={item} index={i} />
              ))}
            </div>

            {/* Footer nav hint */}
            <div className="mt-10 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Nem találtad a választ? Keresd a rendszergazdát vagy nézd meg a többi modult a{' '}
                <span className="text-gray-500 font-medium">bal oldali menüben</span>.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
