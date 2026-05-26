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
  Bot,
  Brain,
  Shield,
  MessageSquare,
  Zap,
  Terminal,
} from 'lucide-react'

interface FaqItem {
  q: string
  a: string | React.ReactNode
  warning?: string
}

interface Module {
  id: string
  label: string
  icon: React.ElementType
  badge?: string
  items: FaqItem[]
}

// ─── Code block helper ────────────────────────────────────────────────────────

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 border border-gray-200 text-blue-700 rounded px-1.5 py-0.5 text-xs font-mono">
      {children}
    </code>
  )
}

function Prompt({ text }: { text: string }) {
  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3 my-2">
      <p className="text-green-400 text-xs font-mono leading-relaxed">{text}</p>
    </div>
  )
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const modules: Module[] = [
  {
    id: 'mcp',
    label: 'MCP – Claude AI',
    icon: Bot,
    badge: 'Új',
    items: [
      {
        q: 'Mi az MCP és miért hasznos?',
        a: (
          <span>
            <p className="mb-3">Az <strong>MCP (Model Context Protocol)</strong> egy nyílt szabvány, amellyel a Claude AI asszisztens közvetlen, valós idejű kapcsolatot tud felépíteni a Memini CRM rendszerrel. Nem egyszerűen &quot;beolvas&quot; adatokat — hanem <strong>élő eszközökön keresztül lekérdez, létrehoz, módosít és elemez</strong>.</p>
            <p className="mb-3">Gondolj úgy rá, mint egy nagyon okos asszisztensre, aki hozzáfér az összes céges adathoz, és tud cselekedni is — nem csak válaszolni.</p>
            <div className="grid grid-cols-1 gap-2 mt-3">
              {[
                ['Lekérdez', 'Listáz cégeket, partnereket, számlákat, feladatokat, készletszinteket'],
                ['Létrehoz', 'Új cég, kontakt, feladat, deal, számla, tevékenység felvitele'],
                ['Módosít', 'Státuszok frissítése, adatok szerkesztése, nyitvatartás beállítása'],
                ['Elemez', 'Statisztikák, cashflow összefoglaló, alacsony készlet riport'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3 p-2.5 bg-blue-50 rounded-lg">
                  <span className="text-blue-600 font-bold text-xs w-16 shrink-0 mt-0.5">{title}</span>
                  <span className="text-gray-600 text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </span>
        ),
      },
      {
        q: 'Hogyan csatlakoztatom a Claude-ot a Meminihez?',
        a: (
          <span>
            <p className="mb-3">Egyszeri beállítás szükséges a Claude asztali alkalmazásban vagy Claude Code-ban:</p>
            <div className="bg-gray-900 rounded-lg px-4 py-3 mb-3">
              <p className="text-gray-400 text-xs font-mono mb-1"># Claude Code terminálban:</p>
              <p className="text-green-400 text-xs font-mono">claude mcp add --transport http -s user &apos;MeminiCRM&apos; &apos;https://memini-app-shell.vercel.app/api/mcp&apos;</p>
            </div>
            <p className="mb-2 text-xs font-semibold text-gray-700">Vagy a .mcp.json fájlba kézzel:</p>
            <div className="bg-gray-900 rounded-lg px-4 py-3 mb-3">
              <pre className="text-green-400 text-xs font-mono whitespace-pre">{`{
  "mcpServers": {
    "memini-crm": {
      "type": "http",
      "url": "https://memini-app-shell.vercel.app/api/mcp",
      "headers": {
        "x-vercel-protection-bypass": "[bypass-secret]"
      }
    }
  }
}`}</pre>
            </div>
            <p className="text-xs text-gray-500">A bypass secret a Vercel dashboardban állítható be (Settings → Deployment Protection → Protection Bypass for Automation).</p>
          </span>
        ),
      },
      {
        q: 'Milyen MCP eszközök érhetők el? — teljes lista',
        a: (
          <span>
            <p className="mb-3 text-xs text-gray-500">50 eszköz áll rendelkezésre, 10 kategóriában:</p>
            {[
              {
                cat: '🏢 Cégek', tools: [
                  ['list_companies', 'Összes cég listázása, keresés névben'],
                  ['get_company', 'Egy cég teljes adatlapja'],
                  ['create_company', 'Új cég felvitele'],
                  ['update_company', 'Cég adatainak módosítása'],
                  ['get_company_hours', 'Nyitvatartás lekérdezése'],
                  ['set_company_hours', 'Nyitvatartás beállítása'],
                ],
              },
              {
                cat: '👤 Partnerek', tools: [
                  ['list_contacts', 'Kontaktok listázása'],
                  ['get_contact', 'Egy kontakt adatai'],
                  ['create_contact', 'Új kontakt felvitele'],
                  ['update_contact', 'Kontakt módosítása'],
                ],
              },
              {
                cat: '💰 Számlák', tools: [
                  ['list_invoices', 'Számlák listázása, szűrés státusz szerint'],
                  ['get_invoice', 'Egy számla részletei'],
                  ['create_invoice', 'Új számla létrehozása'],
                  ['update_invoice_status', 'Státusz módosítása (open/paid/overdue/storno)'],
                ],
              },
              {
                cat: '📦 Megrendelések & Szállítás', tools: [
                  ['list_orders', 'Megrendelések listázása'],
                  ['get_order', 'Egy megrendelés részletei'],
                  ['list_delivery_notes', 'Szállítólevelek listázása'],
                  ['get_delivery_note', 'Egy szállítólevél adatai'],
                  ['update_delivery_note_status', 'Szállítólevél státusz frissítése'],
                ],
              },
              {
                cat: '📊 Pipeline & Dealek', tools: [
                  ['list_deals', 'Aktív dealek listázása'],
                  ['create_deal', 'Új deal felvitele'],
                  ['update_deal', 'Deal adatok vagy fázis módosítása'],
                ],
              },
              {
                cat: '🏭 Termékek & Raktár', tools: [
                  ['list_products', 'Termékek listázása'],
                  ['get_product', 'Egy termék részletei'],
                  ['create_product', 'Új termék felvitele'],
                  ['update_product', 'Termék adatok módosítása'],
                  ['adjust_stock', 'Készlet módosítása (bevét/kivét/korrekció)'],
                  ['get_low_stock_summary', 'Alacsony készlet riport'],
                  ['get_pricelist', 'Árlista lekérdezése'],
                ],
              },
              {
                cat: '✅ Feladatok', tools: [
                  ['list_tasks', 'Feladatok listázása'],
                  ['get_task', 'Egy feladat részletei'],
                  ['create_task', 'Új feladat létrehozása'],
                  ['update_task', 'Feladat státusz, prioritás módosítása'],
                ],
              },
              {
                cat: '📋 Tevékenységnapló', tools: [
                  ['list_activities', 'Tevékenységek listázása'],
                  ['create_activity', 'Új tevékenység rögzítése'],
                  ['update_activity', 'Tevékenység módosítása'],
                ],
              },
              {
                cat: '💸 Pénzügyek', tools: [
                  ['list_expenses', 'Kiadások listázása'],
                  ['update_expense', 'Kiadás módosítása'],
                  ['get_mnb_rate', 'MNB árfolyam lekérdezése'],
                  ['get_stats', 'Összesített üzleti statisztikák'],
                ],
              },
              {
                cat: '🚚 Szállítók & Beszerzés', tools: [
                  ['list_suppliers', 'Szállítók listázása'],
                  ['get_supplier', 'Egy szállító adatai'],
                  ['create_supplier', 'Új szállító felvitele'],
                  ['update_supplier', 'Szállító módosítása'],
                  ['list_carriers', 'Fuvarozók listázása'],
                  ['assign_supplier_to_carrier', 'Szállító hozzárendelése fuvarozóhoz'],
                  ['list_purchase_orders', 'Beszerzési rendelések'],
                  ['get_purchase_order', 'Egy beszerz. rendelés részletei'],
                  ['create_purchase_order', 'Új beszerz. rendelés'],
                  ['update_purchase_order_status', 'Beszerz. rendelés státusz frissítése'],
                ],
              },
            ].map(({ cat, tools }) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-bold text-gray-700 mb-1.5">{cat}</p>
                <div className="space-y-1">
                  {tools.map(([name, desc]) => (
                    <div key={name} className="flex items-start gap-2">
                      <code className="bg-blue-50 border border-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-xs font-mono shrink-0">{name}</code>
                      <span className="text-xs text-gray-500 mt-0.5">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </span>
        ),
      },
      {
        q: 'Példák — mit mondhatok Claude-nak?',
        a: (
          <span>
            <p className="mb-3 text-xs text-gray-600">Természetes nyelvű kéréseket írhatsz — Claude maga dönti el, melyik MCP eszközt használja:</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">📊 Áttekintés, riport</p>
                <Prompt text="Mutasd az összes lejárt számlámat és az összértéküket!" />
                <Prompt text="Milyen a havi cashflow az elmúlt 3 hónapban?" />
                <Prompt text="Melyik termékekből fogy el a készlet hamarosan?" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">🏢 Cégek kezelése</p>
                <Prompt text="Keresd meg a Müller GmbH céget és mutasd az összes nyitott számláját!" />
                <Prompt text="Add hozzá a Schmidt GmbH nyitvatartását: hétfőtől péntekig 9-17 óráig nyitva." />
                <Prompt text="Frissítsd a Bauer AG besorolását B-ről A-ra — rendszeresen rendelnek." />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">✅ Feladatok</p>
                <Prompt text="Hozz létre feladatot: hívjam fel a Müller GmbH-t ajánlategyeztetés miatt, határidő jövő péntek, magas prioritás." />
                <Prompt text="Listázd az összes ma esedékes feladatomat prioritás szerint!" />
                <Prompt text="Jelöld befejezettnek az összes elvégzett e-mail feladatot." />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">📦 Raktár & Termékek</p>
                <Prompt text="Rögzíts 500 db bevétet az ULM-001 SKU-hoz, szállítmány érkezett ma." />
                <Prompt text="Melyik termékek vannak minimum alatti készleten? Írj javaslatot, mit kell rendelni." />
                <Prompt text="Hozz létre új terméket: neve Lindau Mágneses, SKU: LIN-001, ár: 2.50 €, készlet: 200 db." />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">💰 Pénzügyek</p>
                <Prompt text="Mekkora az összes kifizetetlen számla összege jelenleg?" />
                <Prompt text="Mi az aktuális EUR/HUF árfolyam az MNB szerint?" />
                <Prompt text="Jelöld befizettnek a 2024-087-es számot — ma érkezett az utalás." />
              </div>
            </div>
          </span>
        ),
      },
      {
        q: 'Ötletek — mit érdemes kipróbálni MCP-vel?',
        a: (
          <span>
            <div className="space-y-3">
              {[
                {
                  emoji: '🌅',
                  title: 'Reggeli briefing',
                  desc: 'Minden reggel kérd egy összefoglalót: "Mi a legfontosabb ma? Lejárt számlák, esedékes feladatok, alacsony készlet?"',
                  prompt: 'Reggeli összefoglaló: mi a legfontosabb 3 teendő ma a Memini adatai alapján?',
                },
                {
                  emoji: '📞',
                  title: 'Hívás előtti felkészülés',
                  desc: 'Mielőtt felhívsz egy partnert, kérd le az összes releváns adatát egyben.',
                  prompt: 'Fel kell hívnom a Müller GmbH-t — mutasd a legutóbbi rendelésüket, nyitott számláikat és az utolsó tevékenységet velük.',
                },
                {
                  emoji: '📧',
                  title: 'Email előkészítés',
                  desc: 'Claude megkeresi a partner adatait az MCP-vel, majd azonnal megírja a személyre szabott emailt.',
                  prompt: 'A Bauer AG 90 napja nem rendelt. Keress rájuk az MCP-vel, nézd meg az előző rendeléseiket, és írj egy visszaszerző email-t németül.',
                },
                {
                  emoji: '🔍',
                  title: 'Szunnyadó partnerek felkutatása',
                  desc: 'Kérd le, ki nem rendelt 60+ napja, és kérj javaslatot a megkeresési stratégiára.',
                  prompt: 'Listázd azokat a cégeket, akiknél a legutóbbi aktivitás több mint 2 hónapja volt, és javasolj megkeresési stratégiát!',
                },
                {
                  emoji: '📦',
                  title: 'Bővítés tervezése',
                  desc: 'Elemzés alapú döntéstámogatás: mik a legjobban fogyó termékek, mit érdemes utánrendelni.',
                  prompt: 'Nézd meg a terméklistát és a készletszinteket — mik a críütkus tételek? Mit kell most rendelni szállítótól?',
                },
                {
                  emoji: '🏢',
                  title: 'Tömeges adatfrissítés',
                  desc: 'Több cég adatát egyszerre frissítheted — pl. besorolás, csatorna, megjegyzés.',
                  prompt: 'A következő cégeket szeretném A besorolásra állítani: Müller GmbH, Bauer AG, Schmidt KG. Csináld meg!',
                },
                {
                  emoji: '📊',
                  title: 'Heti riport generálás',
                  desc: 'Kérj strukturált heti összefoglalót exportálható formában.',
                  prompt: 'Készíts heti üzleti riportot: bevételek, új megrendelések, pipeline státusz, nyitott feladatok, kritikus készletek.',
                },
                {
                  emoji: '🌐',
                  title: 'Webes kutatás + memória',
                  desc: 'Claude keres a neten egy cégről, és amit talál, beírja a Memini Memória fülébe.',
                  prompt: 'Keresd meg a Müller GmbH weblapját, és amit fontosnak találsz (pl. termékkör, méret, kapcsolattartó), mentsd el a Memini memóriájába!',
                },
              ].map(({ emoji, title, desc, prompt }) => (
                <div key={title} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{emoji}</span>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 pl-7">{desc}</p>
                  <div className="bg-gray-900 rounded-lg px-3 py-2 ml-7">
                    <p className="text-green-400 text-xs font-mono leading-relaxed">{prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </span>
        ),
      },
      {
        q: 'Hogyan kell "irányítani" a Claude-ot MCP-n keresztül?',
        a: (
          <span>
            <p className="mb-3">Nem kell parancsokat memorizálni — Claude természetes magyar szövegből érti, mit akar. Néhány tipp a hatékonyabb munkához:</p>
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-bold text-green-800 mb-1">✅ Hatékony megközelítések</p>
                <ul className="space-y-1 text-xs text-green-700 list-disc list-inside">
                  <li>Legyél konkrét: cégnév, SKU, dátum megadásával pontosabb eredmény</li>
                  <li>Kérj összetett feladatot: &quot;keress rá, nézd meg, és frissítsd&quot;</li>
                  <li>Kérhetsz összefoglalót és cselekvést egyszerre</li>
                  <li>Ha több lépés van, sorolhatod: &quot;először X, utána Y&quot;</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-800 mb-1">💡 Hasznos trükkök</p>
                <ul className="space-y-1 text-xs text-amber-700 list-disc list-inside">
                  <li>Mondhatod: &quot;ne kérdezz vissza, csináld meg&quot; ha biztos vagy benne</li>
                  <li>&quot;Listázd ki pontosan 10 cég adatát Excel-be másolható formában&quot;</li>
                  <li>&quot;Ha nem találod, keress hasonló nevűt is&quot;</li>
                  <li>Claude elmagyarázza mit csinál — ha nem kell, mondd: &quot;csak az eredmény kell&quot;</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-800 mb-1">⚠️ Amire figyelj</p>
                <ul className="space-y-1 text-xs text-red-700 list-disc list-inside">
                  <li>Törlés nincs az MCP-ben — csak módosítás és létrehozás</li>
                  <li>Az MCP nem fér hozzá a backup rendszerhez (szándékos biztonsági döntés)</li>
                  <li>Mielőtt tömeges módosítást kérsz, kérj előnézetet: &quot;először mutasd meg mit változtatnál&quot;</li>
                </ul>
              </div>
            </div>
          </span>
        ),
      },
    ],
  },
  {
    id: 'memoria',
    label: 'Memória & Sablonok',
    icon: Brain,
    badge: 'Új',
    items: [
      {
        q: 'Mi az a Memória fül a cégeknél és partnerek?',
        a: (
          <span>
            <p className="mb-3">A Memória fül egy strukturált, típusonkénti emlékeztető rendszer minden céghez és partnerhez. Ide rögzíthetsz mindent, amit fontos tudni róluk — születésnaptól személyes preferenciákon át üzleti részletekig.</p>
            <div className="space-y-2 mt-2">
              {[
                ['🎂', 'Születésnap', 'Fontos dátumok — névnap, cégalapítás évfordulója'],
                ['💬', 'Mondta ezt', 'Amit a partner mondott és érdemes megjegyezni'],
                ['👤', 'Személyes', 'Hobbi, érdeklődési kör, preferenciák'],
                ['🏢', 'Üzleti', 'Termékérdeklődés, tárgyalási tapasztalatok, elvárások'],
                ['🌐', 'Webes forrás', 'Interneten talált releváns információk'],
                ['📌', 'Egyéb', 'Bármilyen más feljegyeznivaló'],
              ].map(([icon, label, desc]) => (
                <div key={label} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-lg shrink-0">{icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">A típusok bővíthetők a Beállítások → Kommunikáció fülön.</p>
          </span>
        ),
      },
      {
        q: 'Mi az a webes kutatás a Memória fülön?',
        a: 'A Memória fülön van egy "Webes kutatás" gomb. Ha rákattintasz, az MCP segítségével Claude megkeresi a céget az interneten (Brave Search API), és a valós, ellenőrzött forrásokból talált releváns információkat automatikusan beírja a memóriába. Fontos: kizárólag valós forrásokat használ — semmiféle kitalált vagy hallucináló tartalmat nem ment be.',
        warning: 'A webes kutatás csak akkor elérhető, ha a BRAVE_SEARCH_API_KEY be van állítva a Vercelben. Enélkül is működik a rendszer, csak a kutató gomb inaktív marad.',
      },
      {
        q: 'Mi az a Sablonok fül és hogyan működik?',
        a: (
          <span>
            <p className="mb-3">A Sablonok fül lehetővé teszi, hogy előre megírt kommunikációs sablonokból egy kattintással személyre szabott üzeneteket generálj — emailt, WhatsApp üzenetet vagy telefon scriptet.</p>
            <ol className="space-y-2 list-decimal list-inside text-xs text-gray-600">
              <li>Válassz sablont a kártyák közül (pl. &quot;Ajánlatkísérő email&quot;)</li>
              <li>Megnyílik a generáló ablak — Claude felhasználja a partner és a memória adatait</li>
              <li>Bal oldal: magyar szöveg, amit szerkeszthetsz</li>
              <li>Jobb oldal: egy gombra fordítja le németre a Claude</li>
              <li>Másolás gombbal kiviheted a szöveget emailbe vagy WhatsApp-ba</li>
            </ol>
          </span>
        ),
      },
      {
        q: 'Hogyan adhatok hozzá új sablon típusokat?',
        a: 'A Beállítások → Kommunikáció fülön kezelheted a sablon típusokat (Email, WhatsApp, Telefon script) és a memória típusokat is. Mindkettő bővíthető új típusokkal — adj meg nevet és ikont, és megjelenik a felületen.',
      },
      {
        q: 'Hogyan töltöm fel az alapértelmezett sablonokat?',
        a: (
          <span>
            <p className="mb-2">Első használat előtt szükséges az alapértelmezett adatok betöltése. Menj a <strong>Beállítások → Kommunikáció</strong> fülre, és kattints az <strong>⚡ Alapértelmezések betöltése</strong> gombra.</p>
            <p className="text-xs text-gray-500">Ez feltölti az alap memória típusokat (🎂💬👤🏢🌐📌), a sablon típusokat (✉️💬📞) és 3 minta kommunikációs sablont.</p>
          </span>
        ),
        warning: 'Ha ez nem fut le egyszer, a Sablonok és Memória fül üres lesz. Érdemes ezt az első telepítés után azonnal elvégezni.',
      },
    ],
  },
  {
    id: 'backup',
    label: 'Biztonsági mentés',
    icon: Shield,
    badge: 'Új',
    items: [
      {
        q: 'Hogyan menthetem le az összes adatot?',
        a: (
          <span>
            <p className="mb-3">A <strong>/backup</strong> oldalon (Beállítások → Biztonsági mentés) egy gombra letöltheted az összes adatot egyetlen JSON fájlba. PIN kód szükséges a letöltéshez.</p>
            <p className="text-xs text-gray-600">A backup tartalmaz: cégek, partnerek, termékek, számlák, megrendelések, szállítólevelek, dealek, feladatok, kiadások, készletmozgások, árlista, szállítók, memória bejegyzések, sablonok — mindent.</p>
          </span>
        ),
      },
      {
        q: 'Mi az a PIN kód és hol állítom be?',
        a: (
          <span>
            <p className="mb-2">A backup letöltéséhez és visszaállításhoz egy 6 jegyű PIN kód szükséges. Ez védi az adatokat illetéktelen hozzáféréstől.</p>
            <p className="mb-2">A PIN-t a Vercel dashboardban kell beállítani:</p>
            <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono text-gray-700">
              Vercel → Project → Settings → Environment Variables → BACKUP_PIN = 123456
            </div>
            <p className="mt-2 text-xs text-gray-500">A PIN-t senki más nem látja — sem a kódban, sem a rendszerben. Ha elfelejtened, a Vercel dashboardban mindig megnézheted vagy megváltoztathatod.</p>
          </span>
        ),
      },
      {
        q: 'Hogyan állítom vissza az adatokat backup fájlból?',
        a: (
          <span>
            <p className="mb-3">A /backup oldalon a Visszaállítás szekció alatt:</p>
            <ol className="space-y-1.5 list-decimal list-inside text-xs text-gray-600">
              <li>Töltsd fel a .json backup fájlt</li>
              <li>Válaszd a visszaállítás módját</li>
              <li>Jelöld be a megerősítő checkboxot</li>
              <li>Kattints a gombra — megjelenik a PIN modal</li>
              <li>Add meg a 6 jegyű PIN-t</li>
            </ol>
            <div className="mt-3 space-y-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-bold text-blue-800">Biztonságos mód</p>
                <p className="text-xs text-blue-700 mt-0.5">Csak a hiányzó rekordokat szúrja be — a meglévő adatokat nem érinti. Ajánlott elsőként kipróbálni.</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-800">Teljes visszaállítás</p>
                <p className="text-xs text-red-700 mt-0.5">Törli az összes jelenlegi adatot, majd újratölti a backupból. Használd ha az egész rendszert vissza kell állítani egy korábbi állapotra.</p>
              </div>
            </div>
          </span>
        ),
        warning: 'A teljes visszaállítás visszafordíthatatlan! Előtte mindig töltsd le az aktuális adatokat is.',
      },
      {
        q: 'Mikor fut az automatikus napi mentés?',
        a: 'Minden éjjel 02:00-kor a Vercel automatikusan lefuttatja a backup cron jobot, és elmenti az adatokat a Vercel Blob tárolóba (backups/memini-backup-YYYY-MM-DD.json formátumban). Ez független a kézi letöltéstől — akkor is fut, ha nem lépsz be az appba.',
      },
      {
        q: 'Hol találom az automatikus mentéseket?',
        a: (
          <span>
            <p className="mb-2">A napi automatikus mentések a Vercel Blob tárolóban vannak:</p>
            <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono text-gray-700">
              Vercel → Project → Storage → Blob → backups/
            </div>
            <p className="mt-2 text-xs text-gray-500">Ott látod az összes napi mentést listázva, és közvetlenül le is töltheted bármelyiket.</p>
          </span>
        ),
      },
      {
        q: 'Mi a heti backup emlékeztető?',
        a: 'Minden hétfőn reggel az Arthur AI heti feladat-összesítőjével együtt létrehoz egy feladatot: "💾 Heti biztonsági mentés letöltése". Ez emlékeztet, hogy töltsd le a backup fájlt és mentsd el külső helyre (Google Drive, USB). A napi automata Blob mentés mellé javasolt hetente kézi mentést is csinálni.',
      },
    ],
  },
  {
    id: 'altalanos',
    label: 'Általános',
    icon: HelpCircle,
    items: [
      {
        q: 'Mi az a Memini CRM?',
        a: 'A Memini egy felhőalapú, magyar nyelvű CRM és ERP rendszer, amelyet design- és kereskedelmi vállalkozások számára fejlesztettünk. Kezeli a partnereket, cégeket, megrendeléseket, számlákat, raktárkészletet, feladatokat, pénzügyeket — és Claude AI integrációval természetes nyelven is irányítható.',
      },
      {
        q: 'Hogyan navigálhatok a rendszerben asztali gépen?',
        a: 'A bal oldalon található sötét navigációs sáv (Sidebar) csoportokba rendezi a modulokat: CRM, Értékesítés, Raktár, Pénzügy, Feladatok. Kattints bármelyik menüpontra a megnyitáshoz.',
      },
      {
        q: 'Hogyan navigálhatok mobilon?',
        a: 'Mobilon a képernyő alján jelenik meg a navigáció a legfontosabb oldalakkal. A jobb szélső "Több" gombra koppintva megnyílik az összes modul. A fiókot a jobb felső X gombbal zárhatod be.',
      },
      {
        q: 'Automatikusan mentődnek az adatok?',
        a: 'Igen. Minden Mentés gombra kattintás azonnal elmenti az adatokat. Ha bezárod az ablakot kitöltés közben, a még el nem mentett változtatások elveszhetnek.',
        warning: 'A böngésző visszagombja vagy a lap bezárása mentetlen adatvesztést okozhat! Mindig mentsd el az űrlapot a kilépés előtt.',
      },
      {
        q: 'Hogyan kereshetek az oldalon belül?',
        a: 'Minden listaoldalon (Cégek, Ügyfelek, Megrendelések stb.) az oldal tetején találsz keresőmezőt. Gépelj bele és a lista valós időben szűrődik névra, azonosítóra és egyéb kulcsmezőkre.',
      },
      {
        q: 'Több felhasználó is használhatja egyszerre?',
        a: 'Igen, többfelhasználós rendszer. Mindenki a saját fiókjával lép be, feladatokat és megrendeléseket munkatársakhoz lehet rendelni.',
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
        a: 'Nyisd meg a Cégek modult, kattints az "+ Új cég" gombra. Az egyetlen kötelező mező a cég neve. A többi (cím, kapcsolattartó, partner típus, besorolás, nyitvatartás) opcionális, de ajánlott kitölteni.',
      },
      {
        q: 'Mit jelent a Memória és Sablonok fül a cégnél?',
        a: (
          <span>
            A cég adatlapján két új fül érhető el:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600 text-xs">
              <li><strong>Memória:</strong> strukturált feljegyzések a cégről (születésnap, mondta ezt, üzleti info, webes forrás) — az AI sablon generáláshoz is felhasználja ezeket</li>
              <li><strong>Sablonok:</strong> kommunikációs sablonok (email, WhatsApp, telefon script) — egy kattintásra személyre szabott üzenetet generál Claude</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Hogyan állítom be a nyitvatartást?',
        a: 'A cég szerkesztési űrlapján a Nyitvatartás szekcióban beállítható minden napra az nyitási és zárási idő, vagy megjelölhető zárva. Időszakos nyitvatartást is lehet hozzáadni (pl. nyári menetrend, ünnepek). A cég adatlapján a bal sávban megjelenik az aktuális állapot (nyitva/zárva) és a heti menetrend.',
      },
      {
        q: 'Mit jelentenek a partner típusok?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>Endkunde</strong> — végfelhasználó, közvetlenül tőlünk vásárol</li>
              <li><strong>Distributor</strong> — nagykereskedő, más kereskedőknek ad el</li>
              <li><strong>Einzelhandel</strong> — kiskereskedő, boltban vagy webshopban értékesít</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Mit jelent az A-D besorolás?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>A – Kiemelt partner:</strong> rendszeresen vásárol, nagy forgalmat generál</li>
              <li><strong>B – Rendszeres partner:</strong> stabil, közepes forgalmú ügyfél</li>
              <li><strong>C – Alkalmi partner:</strong> ritkán vásárol</li>
              <li><strong>D – Inaktív / Potenciális:</strong> még nem vásárolt, vagy régen nem rendelt (alapértelmezett)</li>
            </ul>
          </span>
        ),
        warning: 'A Dashboard "Szunnyadó partnerek" figyelmeztetése automatikusan kiemeli azokat a cégeket, amelyek több mint 90 napja nem rendeltek.',
      },
      {
        q: 'Hogyan törölhetek vagy szerkeszthetek egy céget?',
        a: 'A cég listában kattints a szerkesztés (ceruza) ikonra, vagy nyisd meg az adatlapot és kattints a "Szerkesztés" gombra. Törlés esetén megjelenik egy megerősítő ablak.',
        warning: 'A törlés végleges — az összes hozzárendelt adat (megrendelések, számlák, memória) elveszhet.',
      },
    ],
  },
  {
    id: 'ugyfelek',
    label: 'Partnerek',
    icon: Users,
    items: [
      {
        q: 'Mi a különbség az "Ügyfél" és a "Cég" között?',
        a: 'Az "Ügyfél" (kontakt) egy konkrét személy — pl. a partner cég képviselője. A "Cég" a szervezet maga. Egy cégnek több ügyfelje is lehet. Összekapcsolhatók egymással.',
      },
      {
        q: 'Hogyan veszek fel új partnert (kontaktot)?',
        a: 'Nyisd meg az Ügyfelek modult, kattints az "+ Új ügyfél" gombra. Kötelező: keresztnév és vezetéknév. Opcionális: email, telefon, kapcsolódó cég, státusz, megjegyzések.',
      },
      {
        q: 'Hogyan kapcsolom össze az ügyfelet egy céggel?',
        a: 'A szerkesztési űrlapon a "Cég" legördülő mezőben keress rá a cég nevére. Az összekapcsolt kontakt megjelenik a cég adatlapján is.',
      },
      {
        q: 'Mit találok a partner Memória és Sablonok fülén?',
        a: 'Ugyanaz, mint a cégeknél — strukturált emlékeztetők (személyes, üzleti, születésnap stb.) és kommunikációs sablonok. A sablon generáló figyelembe veszi a partnerhez rögzített memóriákat is.',
      },
      {
        q: 'Mit jelentenek az ügyfél állapot mezők?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>Lead:</strong> potenciális ügyfél, még nem kerestük meg</li>
              <li><strong>Megkeresve:</strong> felvettük a kapcsolatot</li>
              <li><strong>Egyeztetés alatt:</strong> aktív tárgyalás</li>
              <li><strong>Ajánlat elküldve:</strong> árajánlatot kapott</li>
              <li><strong>Aktív partner:</strong> rendszeresen vásárol</li>
              <li><strong>Inaktív:</strong> korábbi ügyfél, jelenleg nem vásárol</li>
            </ul>
          </span>
        ),
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
        a: 'A Lead Pipeline az értékesítési folyamatot vizualizálja Kanban-táblás formában. Minden oszlop egy értékesítési fázist jelképez — a hideg leadtől az aktív partnerig.',
      },
      {
        q: 'Milyen fázisok vannak?',
        a: (
          <span>
            <ol className="space-y-1 list-decimal list-inside text-gray-600 text-sm">
              <li><strong>Hideg lead</strong> — még nem kerestük meg</li>
              <li><strong>Megkeresve</strong> — felvettük a kapcsolatot</li>
              <li><strong>Egyeztetés</strong> — aktív tárgyalás</li>
              <li><strong>Ajánlat elküldve</strong> — döntés várható</li>
              <li><strong>Aktív partner</strong> — megkötöttük az üzletet</li>
            </ol>
            <p className="mt-2 text-sm">Az "Elveszett" fázis azoknak, akik nem váltak ügyféllé.</p>
          </span>
        ),
      },
      {
        q: 'Hogyan változtathatok fázist?',
        a: 'Kétféleképpen: (1) Húzd a deal kártyáját egyik oszlopból a másikba (drag-and-drop). (2) Nyisd meg a deal részleteit és a legördülő "Fázis" mezőben válts, majd mentsd el.',
      },
      {
        q: 'Hogyan veszek fel új dealét?',
        a: 'A Pipeline oldalon kattints az "+ Új deal" gombra. Add meg a nevet, rendeld hozzá céghez/kontakthoz, adj becsült értéket és várható zárási dátumot.',
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
        a: 'Megrendelések modul → "+ Új megrendelés". Első lépésként kötelező kiválasztani a partnercéget. Ezután add meg a dátumot, szállítási módot, termékeket.',
        warning: 'A partnercég kiválasztása kötelező és a megrendelés létrehozása után nem módosítható.',
      },
      {
        q: 'Milyen státuszai vannak egy megrendelésnek?',
        a: (
          <span>
            <ol className="space-y-1 list-decimal list-inside text-gray-600 text-sm">
              <li><strong>Függőben</strong> — rögzítve, de nem visszaigazolva</li>
              <li><strong>Visszaigazolva</strong> — partner visszaigazolta</li>
              <li><strong>Gyártásban</strong> — készítés alatt</li>
              <li><strong>Kiszállítva</strong> — útban a partner felé</li>
              <li><strong>Átadva</strong> — partner megkapta</li>
            </ol>
          </span>
        ),
      },
      {
        q: 'Hogyan generálok számlát egy megrendelésből?',
        a: 'A megrendelés adatlapján kattints a "Számla generálása" gombra. A rendszer automatikusan létrehozza a számlát a megrendelés adataival.',
      },
      {
        q: 'Hogyan ismételhetek meg egy megrendelést?',
        a: 'A megrendelés adatlapján kattints a "Megismétlés" gombra. Létrehoz egy új, azonos tartalmú megrendelést "Függőben" státusszal, amit szerkeszthetsz.',
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
        a: 'Kétféleképpen: (1) Megrendelésből: "Számla generálása" gomb. (2) Manuálisan: Számlák modul → "+ Új számla".',
      },
      {
        q: 'Milyen státuszai vannak a számlának?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>Nyitott</strong> — kiküldve, fizetés nem érkezett</li>
              <li><strong>Befizetve</strong> — partner kifizette</li>
              <li><strong>Lejárt</strong> — határidő elmúlt, nincs fizetve</li>
              <li><strong>Stornó</strong> — érvénytelenítve</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Hogyan készíthetek stornó számlát?',
        a: 'A számla adatlapján kattints a "Stornó számla készítése" gombra. Automatikusan létrehoz egy negatív összegű stornó számlát.',
        warning: 'A stornózás visszavonhatatlan! Az eredeti számla véglegesen "Stornó" státuszba kerül.',
      },
      {
        q: 'Hogyan jelzem befizettnek?',
        a: 'Nyisd meg a számla adatlapját, módosítsd a státuszt "Befizetve"-re. Rögzítheted a befizetés dátumát is.',
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
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>Hívás:</strong> telefonos megkeresés</li>
              <li><strong>E-mail:</strong> írásos kommunikáció</li>
              <li><strong>Személyes találkozó:</strong> tárgyalás, meeting</li>
              <li><strong>Ajánlatírás:</strong> árajánlat elkészítése</li>
              <li><strong>Számlaírás:</strong> számla készítése</li>
              <li><strong>Adminisztráció:</strong> belső feladatok</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Mik azok az automatikus feladatok?',
        a: 'Bizonyos rendszeresemények automatikus feladatokat hoznak létre: lejárt számlák, Arthur AI heti elemzés, heti backup emlékeztető. Ezeket a feladatlistában az ikon és a típus azonosítja.',
        warning: 'Az automatikus feladatokat ne töröld figyelmetlenül — fontos emlékeztetők lehetnek.',
      },
      {
        q: 'Mi az a részfeladat és hogyan hozok létre?',
        a: 'A feladat adatlapján görgess a "Részfeladatok" szekcióhoz, kattints a "+ Részfeladat hozzáadása" gombra. Minden részfeladat jelölhető elvégezettként.',
      },
      {
        q: 'Hogyan jelölök egy feladatot elvégzettnek?',
        a: 'A feladatlistában kattints a jelölőnégyzetre, vagy nyisd meg és változtasd az állapotát "Elvégezve"-re. Az elvégzett feladatok elrejthetők / megjeleníthetők a szűrővel.',
      },
    ],
  },
  {
    id: 'raktar',
    label: 'Raktár',
    icon: Package,
    items: [
      {
        q: 'Hogyan veszek fel új terméket?',
        a: 'Raktár modul → "+ Új termék". Kötelező: termék neve és SKU (egyedi raktári azonosítókód). Opcionális: leírás, ár, minimum készlet, raktárhely, fotó.',
        warning: 'Az SKU kód kötelező és egyedi — duplikált SKU hibát okoz.',
      },
      {
        q: 'Hogyan rögzíthetek készletmozgást?',
        a: (
          <span>
            A termék adatlapján "Készletmozgás" gombra kattintva háromféle mozgást rögzíthetsz:
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>Bevét:</strong> készlet növelése (szállítmány érkezett)</li>
              <li><strong>Kivét:</strong> készlet csökkentése (kiszállítás, selejtezés)</li>
              <li><strong>Korrekció:</strong> konkrét értékre állítás (leltár után)</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Hogyan működik a minimum készlet figyelmeztetés?',
        a: 'Ha a készlet a beállított minimum alá csökken, a termék piros jelzéssel jelenik meg, és a Dashboard is figyelmeztet.',
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
        a: 'Mennyiségtől függő kedvezményrendszer — minél több terméket rendel a partner egyszerre, annál kisebb az egységár. A rendszer automatikusan alkalmazza a megrendelésben.',
      },
      {
        q: 'Hogyan rendelem hozzá az árlistát termékhez?',
        a: 'Raktár → termék szerkesztése → "Árlista" mező → kiválasztás. Mentés után a termékre érvényes a kiválasztott tier árazás.',
      },
      {
        q: 'Módosíthatom az árlistát már meglévő megrendeléseken?',
        a: 'Nem. Az árlista változtatása csak az új megrendelésekre érvényes.',
        warning: 'Az árlista módosítása csak jövőbeli megrendelésekre hat.',
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
        a: 'Pénzügy / Cashflow modul → "+ Új tranzakció" → "Kiadás" típus. Add meg az összeget, dátumot, kategóriát és leírást.',
      },
      {
        q: 'Mi az az OCR és hogyan segít?',
        a: 'Az OCR automatikusan kinyeri a szövegezést a feltöltött számlaképből és előtölti a mezőket.',
        warning: 'Az OCR nem mindig 100%-os — feltöltés után mindig ellenőrizd a kinyert adatokat!',
      },
      {
        q: 'Hogyan állíthatok be visszatérő költséget?',
        a: 'A tranzakció szerkesztőjénél jelöld be a "Visszatérő" opciót, add meg a frekvenciát (havi, negyedéves, éves). A rendszer automatikusan létrehozza a következő időszakban.',
      },
      {
        q: 'Mi az az MNB árfolyam?',
        a: 'Az MCP get_mnb_rate eszközzel lekérdezhető az aktuális MNB (Magyar Nemzeti Bank) EUR/HUF árfolyam. Ez hasznos ha forintban denominált kiadásokat euróba kell átszámolni.',
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      {
        q: 'Mit mutat a Dashboard?',
        a: (
          <span>
            <ul className="space-y-1 list-disc list-inside text-gray-600 text-sm">
              <li><strong>KPI kártyák:</strong> nyitott számlák, havi bevétel/kiadás, pipeline értéke, ügyfelek száma, nyitott feladatok</li>
              <li><strong>Figyelmeztetések:</strong> lejárt számlák, alacsony készlet, szunnyadó partnerek</li>
              <li><strong>Cashflow grafikon:</strong> utolsó 6 hónap trendje</li>
              <li><strong>Közelgő feladatok:</strong> legsürgősebb teendők</li>
              <li><strong>Sales pipeline:</strong> dealek fázis szerinti megoszlása</li>
            </ul>
          </span>
        ),
      },
      {
        q: 'Mit jelent a "Szunnyadó partner" figyelmeztetés?',
        a: 'Ha egy cég több mint 90 napja nem rendelt, "szunnyadó partnernek" minősül. A Dashboard névszerint felsorolja őket, hogy időben felvehessük a kapcsolatot.',
      },
      {
        q: 'Hogyan frissülnek az adatok?',
        a: 'Minden oldalbetöltéskor frissülnek az adatbázisból. Friss adatért töltsd újra az oldalt (F5).',
      },
    ],
  },
  {
    id: 'arthur',
    label: 'Arthur AI',
    icon: Zap,
    items: [
      {
        q: 'Ki az Arthur és mit csinál?',
        a: 'Arthur a Memini beépített AI asszisztense (Claude Sonnet alapon). Minden hétfőn reggel 6-kor automatikusan elemzi az elmúlt hét adatait — bevételek, megrendelések, aktív dealek — és létrehozza a feladatokat a hétre. Riportját a rendszer elmenti.',
      },
      {
        q: 'Hol látom Arthur riportjait?',
        a: 'A Dashboard Arthur szekciójában jelenik meg a legutóbbi heti összefoglaló, és az Arthur által javasolt/létrehozott feladatok megjelennek a Feladatok listában "arthur" típussal jelölve.',
      },
      {
        q: 'Mi a különbség Arthur és az MCP között?',
        a: (
          <span>
            <div className="space-y-2">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs font-bold text-purple-800">Arthur (beépített AI)</p>
                <p className="text-xs text-purple-700 mt-0.5">Automatikusan fut hetente, elemez és feladatokat hoz létre. Passzív — nincs szükség beavatkozásra.</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-800">MCP (Claude + te)</p>
                <p className="text-xs text-blue-700 mt-0.5">Te irányítod valós időben — kérdezel, kérsz, módosítasz. Interaktív és azonnali.</p>
              </div>
            </div>
          </span>
        ),
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
  const [activeId, setActiveId] = useState('mcp')

  const activeModule = modules.find((m) => m.id === activeId) ?? modules[0]

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <HelpCircle size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Súgó és GYIK</h1>
              <p className="text-gray-500 text-sm">Memini CRM — Felhasználói kézikönyv & MCP integráció</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Mobile tab bar */}
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
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={13} />
                  {m.label}
                  {m.badge && (
                    <span className={`text-xs rounded-full px-1.5 py-0 font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                      {m.badge}
                    </span>
                  )}
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
                    <span className="flex-1">{m.label}</span>
                    {m.badge && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                        {m.badge}
                      </span>
                    )}
                    {isActive && !m.badge && (
                      <span className="ml-auto bg-white/20 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {m.items.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto p-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Terminal size={12} />
                <span>MCP: 50 eszköz aktív</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <MessageSquare size={12} />
                <span>Claude Sonnet 4.6</span>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 p-4 md:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <activeModule.icon size={16} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{activeModule.label}</h2>
                {activeModule.badge && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                    {activeModule.badge}
                  </span>
                )}
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                  {activeModule.items.length} téma
                </span>
              </div>
              <p className="text-sm text-gray-500 pl-11">Kattints egy kérdésre a részletes válasz megtekintéséhez.</p>
            </div>

            <div className="space-y-2">
              {activeModule.items.map((item, i) => (
                <AccordionItem key={i} item={item} index={i} />
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Nem találtad a választ? Kérdezd Claude-ot közvetlenül MCP-n keresztül, vagy nézd meg a többi modult a bal oldali menüben.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
