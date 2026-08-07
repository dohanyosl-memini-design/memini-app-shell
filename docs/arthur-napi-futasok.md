# Arthur napi futásai — utasítások a Memini Brain-hez

Ez a négy prompt Arthur ütemezett futásaiba való. Minden futás a Memini CRM
MCP-kapcsolatra támaszkodik. A napi napló és a hosszú távú tudás építése ezekből
áll össze.

**Időzítés (helyi idő):** 06:00 vezetői összefoglaló · 12:00 és 16:00
állapotmentés · 20:30 napi zárás.

**Közös alapelvek — mindegyik futásra érvényes:**

- Először mindig `get_daily_facts` — és KIZÁRÓLAG a kapott tényekből dolgozz.
  Rendelésszámot, összeget, dátumot soha ne találj ki.
- Ha következtetsz valamire, ami nem tény, jelöld: a Brain-tool-oknál
  `confidence: "assumed"`.
- Ha nem történt semmi, a napló két sor legyen — ne tölts vattával.
- Levél szövegét soha ne másold a naplóba: csak ki írt, miről, mi a teendő.
- Mielőtt memóriát írsz, nézd meg a `get_daily_facts` `tudas` szekcióját —
  ami már ma bekerült, azt ne írd be másodszor.

---

## 06:00 — Vezetői összefoglaló ("Mizu?")

```
Készíts vezetői összefoglalót a mai naphoz.

1. Olvasd be a tegnapi naplót: get_daily_journal a tegnapi dátumra. Jegyezd meg
   a lastSavedAt értékét — a mai első állapotmentésnél ez lesz a "since".
2. get_daily_facts (mai nap) — a friss helyzetkép.
3. get_open_loops — a nyitott szálak, külön figyelve a lejárt határidejűekre.
4. list_unanswered_emails — a partnerhez kötött, friss válaszra-váró szálak.
   Ha van saját postafiók-hozzáférésed, egészítsd ki belőle.

Ezekből írj egy tömör vezetői összefoglalót MAGYARUL:
- mi történt tegnap, mi haladt, mi akadt el
- mely partnerek várnak válaszra, mely utánkövetések esedékesek
- hol van bevételi lehetőség, hol kockázat
- a nap 3 legfontosabb fókusza

Mentsd el: save_executive_summary (így az Arthur-jelentések közt is megmarad,
nem csak ebben a beszélgetésben).

Ha a helyzetképben tartós tudás merül fel (döntés, tanulság, elvarratlan szál),
rögzítsd a megfelelő tool-lal — de csak ha még nincs rögzítve.
```

## 12:00 és 16:00 — Állapotmentés

```
Napközi állapotmentés a naplóba.

1. Kérd le a mai naplót: get_daily_journal (mai nap). Vedd ki a lastSavedAt
   értékét.
2. get_daily_facts a mai napra, since = az előbbi lastSavedAt — így csak azt
   kapod, ami a legutóbbi mentés óta történt.
3. Ha van saját postafiók-hozzáférésed, nézd át az azóta érkezett érdemi
   leveleket (partnerhez köthető, üzletileg releváns — hírlevél, no-reply nem).

Írd hozzá a naplóhoz: save_daily_journal
- narrative: 1-2 bekezdés, mi történt azóta (append módban fűződik hozzá)
- emailDigest: az érdemi levelek kivonata (from, subject, gist, action,
  companyId) — a levél SZÖVEGE nélkül
- emailSource: "agent", ha a saját postafiókodból dolgoztál
- checkpointLabel: "12:00 állapotmentés" (illetve "16:00 állapotmentés")

Ha időközben döntés vagy ígéret hangzott el, rögzítsd (log_decision indokkal,
log_open_loop következő lépéssel). NE zárd le a napot.
```

*(A 12:00 és a 16:00 futás ugyanezt a promptot használja, csak a
checkpointLabel más — a `since` mechanizmus gondoskodik róla, hogy ne dolgozza
fel kétszer ugyanazt.)*

## 20:30 — Napi zárás

```
Zárd le a mai napot a naplóban.

1. get_daily_journal (mai nap) → lastSavedAt.
2. get_daily_facts a mai napra, since = lastSavedAt — a délután óta történtek.
3. get_open_loops — mi maradt nyitva.
4. get_setbacks unlearnedOnly: true — van-e olyan korábbi kudarc, amiből a mai
   tapasztalat alapján már levonható a tanulság (ilyenkor log_learning, és a
   kudarc státusza update_brain_note-tal "lesson_drawn").

Zárd le: save_daily_journal
- narrative: a nap rövid összegzése (append)
- priorities: a következő nap max 3 fő fókusza
- checkpointLabel: "20:30 napi összefoglaló"
- closeDay: true

KIEMELÉS a hosszú távú memóriába — csak a BIZTOSAT, automatikusan:
- ami egy partnerre igaz és megerősített tény → create_memory (a megfelelő
  céghez/kapcsolathoz). Előbb ellenőrizd a get_daily_facts tudas szekciójában,
  hogy nincs-e már bent.
- döntés, ami ma megszületett és indokolt → log_decision (reason kötelező)
- általánosítható tanulság → log_learning (reusableRule)
- elvarratlan szál → log_open_loop (nextAction, és dueDate ha van)
- ami félrement aznap (elutasítás, csúszás, zsákutca) → log_setback, okkal és
  azzal, hogy mit csinálnánk másképp. Ne szépítsd és ne hagyd ki: a kudarcból
  lesz később a tanulság, és csak akkor kereshető vissza, ha rögzítve van.
- amit a helyzet feltár (nyíló ajtó, piaci rés, váratlan érdeklődés) →
  log_opportunity. FONTOS: egy esemény lehet EGYSZERRE kudarc és lehetőség —
  egy elutasítás, ami egy nagyobb szegmenshez terel, mindkettő. Ilyenkor
  rögzítsd MINDKÉT oldalt: a fájót log_setback-kel, a nyílót log_opportunity-vel.
  Ne rögzíts tisztán pozitív, nagy lehetőséget kudarcként — ha a mérleg pozitív,
  az lehetőség.

Amiben BIZONYTALAN vagy (következtetés, nem megerősített): NE írd be tényként.
Vagy hagyd a napló szövegében, vagy jelöld confidence: "assumed".
```

---

## Miért így

- **A tények mindig kódból jönnek** (`get_daily_facts`), az ügynök csak
  értelmez — így kitalált adat nem kerülhet a naplóba.
- **A `since`/`lastSavedAt` vízjel** biztosítja, hogy a napközi mentések ne
  dolgozzák fel újra ugyanazt. Egy nap egy rekord, a szöveg hozzáfűződik.
- **A kiemelés a záró futásban történik**, de a napközi futások is rögzíthetnek
  friss döntést — így nem a nap végi emlékezeten múlik minden.
- **A biztonsági háló**: ha az esti futás elmarad, a napi cron (02:00 UTC után)
  a tényeket akkor is lementi — a nap nem vész el, csak a narratíva hiányzik.
