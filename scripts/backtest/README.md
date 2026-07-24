# Companion replay-backtest

Egyszer használatos, önálló bizonyítási kísérlet — **nem** CRM-funkció. A Memini
múltbeli adatain időrendben lejátssza az Observation → Hypothesis → Insight
láncot, mintha a Companion élőben figyelt volna, és mérhetővé teszi, mit
mondott volna és mikor.

## A tesztelendő hipotézis (előre rögzítve)

> A Memini múltbeli adataiból időrendben épített observation–hypothesis
> rendszer képes korábban nem explicit, döntésre alkalmas és bizonyítékokkal
> alátámasztott felismeréseket előállítani elfogadható zavarási aránnyal.

**Sikerkritérium** (a futás UTÁN nem módosítható):
1. Companion Value Score > 0 (lásd `score.ts`);
2. legalább egy `+2`-es ("hoppá") tétel a vak értékelésen;
3. zavarási ráta ≤ 3 megszólalás/hét.

Ha a kísérlet megbukik, az is eredmény: a láncot kell javítani, nem a
kritériumot lazítani.

## Architektúra-elvek (a tervezési vitában rögzítve)

- **Három réteg**: RawEvent → Observation → (majd élesben: MemoryEntry).
  Az observation olcsó, sűrű, tényszerű; a tartós memóriába csak konszolidáció
  után kerülne át. A backtest a MemoryEntry-írást nem végzi el.
- **Minden hipotézis a saját halálának feltételével születik**: a
  `falsifyCondition` kötelező mező — enélkül a rekord eldobódik. A judge-prompt
  aktívan keresteti a cáfolatot, nem csak a támogatást.
- **A confidence számolt, nem érzett**: `confidence.ts` determinisztikusan
  deriválja a bizonyíték-gráfból (független partnerek száma > darabszám,
  forrás-diverzitás, frissesség, ellenbizonyíték-arány, minta-küszöb).
- **A megszólalás döntés, nem reflex**: csak státusz-ugráskor, hipotézisenként
  max 3×, 14 nap cooldown. A megdőlt-de-korábban-kimondott hipotézist a
  rendszer bevallja ("alázat-megszólalás").
- **Nincs jövő-szivárgás**: a replay adott napján csak az addig történt
  események láthatók. Ismert korlát: a mutable entitások (Deal, Task) mai
  mezőértékei export-koriak — ezek `stateAsOfExport` jelölést kapnak, és a
  prompt óvatos kezelésre utasít. Az append-only források (TaskEvent, Activity,
  számla, rendelés) torzításmentesek.
- **Vak értékelés**: az `eval-sheet.md` kevert sorrendben, confidence nélkül
  mutatja a megszólalásokat, hogy a megfogalmazás és a magabiztosság ne
  torzítson. A feloldókulcs (`eval-key.json`) csak pontozás után nyitható.
- **Read-only**: az export csak SELECT-eket futtat; az éles adatbázisba semmi
  nem íródik vissza.

## Használat

```bash
# 0) (opcionális) szintetikus fixture + kulcs nélküli csővezeték-teszt
npx tsx scripts/backtest/make-fixture.ts
npx tsx scripts/backtest/replay.ts --export scripts/backtest/fixtures/sample-export.json --provider mock

# 1) Export az éles DB-ből (ahol a DATABASE_URL él) — read-only, anonimizálva
npx tsx scripts/backtest/export.ts --out exports/memini-export.json --anonymize

# 2) Gyors ellenőrzés LLM nélkül: mit látna a rendszer?
npx tsx scripts/backtest/replay.ts --export exports/memini-export.json --dry-run

# 3) Replay — Claude-dal és GPT-vel külön futás, összehasonlításhoz
ANTHROPIC_API_KEY=... npx tsx scripts/backtest/replay.ts --export exports/memini-export.json --provider anthropic --model claude-sonnet-5
OPENAI_API_KEY=...    npx tsx scripts/backtest/replay.ts --export exports/memini-export.json --provider openai --model gpt-4o

# 4) Vak értékelés: töltsd ki a runs/<runId>/eval-sheet.md pontjait, írd be a
#    pontokat a runs/<runId>/eval-key.json "scores" mezőjébe, majd:
npx tsx scripts/backtest/score.ts --run scripts/backtest/runs/<runId>
```

Hasznos kapcsolók: `--from 2026-04-01 --to 2026-07-01` (időablak),
`--max-days 30` (rövid próbafutás), `--out <dir>`.

## Kimenetek (`runs/<runId>/`)

| Fájl | Tartalom |
|---|---|
| `config.json` | a futás teljes konfigurációja (reprodukálhatóság) |
| `observations.jsonl` | minden observation, bizonyíték-linkekkel |
| `hypotheses.json` | hipotézisek életúttal, confidence-történettel |
| `insights.jsonl` | a megszólalások strukturáltan |
| `report.md` | ember-olvasható jelentés: mit / miért / mi cáfolná / miért most |
| `eval-sheet.md` | VAK értékelőlap (+2…−2 skála) |
| `eval-key.json` | feloldókulcs + pontozó-sablon a `score.ts`-nek |
| `metrics.json` | futás-metrikák, köztük a zavarási ráta |

## Az öt értékelési dimenzió

A vak lapon tételenként: **hasznosság** (a Pont maga), **újdonság**
(tudtad-e amúgy is), **megalapozottság** (a report.md bizonyítékai fedik-e),
**időzítés** (elég korán szólt-e), **zavarási költség** (a `metrics.json`
emissionsPerWeek + a 0/−1 pontok).

```
+2  Hoppá, ezt nem vettem észre, fontos
+1  Hasznos megerősítés
 0  Igaz, de érdektelen / már tudtam
-1  Zavaró / gyenge
-2  Téves vagy félrevezető
```

`CVS = Σ pozitív − zavarási költség − téves állítások büntetése`, ahol a
magabiztos tévedés büntetése a legnagyobb (2 + 2×confidence).

## Ami szándékosan NINCS ebben a verzióban

- E-mail forrás (a mail-bridge még nem létezik) — a backtest a ma elérhető
  CRM-adatokon fut; az e-mail bekötése az élő Companion-fázis feladata.
- MemoryEntry-írás, bármilyen DB-írás, éles integráció.
- Kontroll-insightok jövőbeli adatból (a vak értékelés B-változata) — ha az
  első kör ígéretes, második körben érdemes hozzátenni.
