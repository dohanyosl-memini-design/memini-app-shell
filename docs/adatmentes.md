# Memini CRM – Adatmentés és visszaállítás

Ez a leírás arra válaszol: **mi történik, ha az adatbázis elszáll, és honnan
állítom vissza?**

## Az alapelv: szerkezet vs. adat

| Mi | Hol van biztonságban | Milyen gyakran változik |
|----|----------------------|--------------------------|
| **Tábla-szerkezet** (a 49 tábla felépítése) | `prisma/schema.prisma`, a GitHubon | Csak új funkciónál |
| **Adat** (cégek, számlák, e-mailek, sorok) | CSAK adatbázis-mentésben | Minden nap |

A szerkezetet sosem veszíted el: egy üres adatbázison a `prisma db push`
újraépíti mind a 49 táblát a kódból. **Az adatot viszont csak mentés védi** —
a GitHub itt nem segít, mert adat nincs benne.

Ezért az adatot **rendszeresen** kell menteni, nem csak nagyobb változáskor.

## Három védelmi szint

### 1. Neon automatikus időutazása (magától megy)
A Neon minden változásról előzményt vezet, és vissza tudsz állni egy korábbi
időpontra (point-in-time restore), vagy készíthetsz egy branchet a múltból.
Ingyenes csomagon jellemzően ~7 nap, fizetősön több. Ehhez nem kell tenned
semmit — a Neon vezérlőpultján érhető el. Ez a „véletlen törlés tegnap" háló.

### 2. Beépített napi mentés (magától megy, e-mailbe)
Az app minden hajnalban ment (`/api/cron/backup`): egy JSON fájlt tesz a
Vercel tárhelyre, és e-mailben is elküldi, ha be van állítva a `BACKUP_EMAIL`
és a `RESEND_API_KEY` környezeti változó. Kézzel is indítható a felületről
(PIN-nel). Visszaállítás: `/api/admin/restore`.

> **FIGYELEM – jelenleg részleges.** Ez a JSON-mentés a ~28 üzleti táblát
> menti (cégek, kapcsolatok, számlák, ajánlatok, megrendelések, termékek,
> feladatok, árlista, beszállítók…), de **kihagyja** az e-mail rendszert, a
> marketinget, a célokat/KPI-t és a felhasználókat. Teljes körű mentéshez
> lásd a 3. pontot, vagy egészítsd ki a backup-kódot.

### 3. Teljes mentés: `pg_dump` (a katasztrófa-védelem)
Ez menti le tényleg MINDENT (szerkezet + összes tábla összes sora), egyetlen
fájlba. Ezt futtasd le mérföldköveknél (nagyobb import előtt/után, havonta),
és a fájlt rakd biztonságos helyre (Drive, külső lemez).

## pg_dump lépésről lépésre

### Előkészület: a Postgres eszközök telepítése (egyszer)
- **Mac:** `brew install postgresql@17` — utána elérhető a `pg_dump`.
- **Windows:** telepítsd a PostgreSQL-t a https://www.postgresql.org/download/
  oldalról (a telepítő tartalmazza a `pg_dump`-ot).
- Fontos: a `pg_dump` verziója legalább akkora legyen, mint a szerveré. A Neon
  most PostgreSQL **17**, ezért 17-es (vagy újabb) eszközök kellenek.

### 1. lépés – a connection string megszerzése a Neonból
1. Lépj be a Neon vezérlőpultba (https://console.neon.tech).
2. Válaszd ki a Memini projektet.
3. A „Connection string" doboznál másold ki a teljes `postgresql://...`
   szöveget. Ha van „Pooled" és „Direct" opció, a **Direct** (pooler nélküli)
   kell. A végén legyen benne a `?sslmode=require`.

### 2. lépés – a mentés elkészítése
Nyiss egy terminált, és illeszd be (a `<...>` helyére a connection string):

```bash
pg_dump "postgresql://<connection-string>?sslmode=require" \
  --no-owner --no-privileges \
  -f memini-mentes-2026-07-31.sql
```

Pár másodperc–perc, és a mappádban ott a `memini-mentes-2026-07-31.sql`.
Ez a fájl a teljes adatbázis. Tedd biztonságos helyre.
(A `--no-owner --no-privileges` azért kell, hogy egy másik Neon-projektbe is
gond nélkül visszaállítható legyen.)

### 3. lépés – visszaállítás (ha valaha kell)
Egy ÜRES adatbázisba (pl. új Neon-projekt) töltöd vissza:

```bash
psql "postgresql://<uj-connection-string>?sslmode=require" \
  -f memini-mentes-2026-07-31.sql
```

Ez visszaépíti a táblákat és beölti az összes adatot, ahogy a mentés
pillanatában volt.

## Gyakorlati javaslat egy egyszemélyes cégnek

- **Naponta:** a Neon időutazása + a beépített JSON-mentés (automatikus).
- **Havonta / nagyobb import előtt:** egy `pg_dump`, a fájlt Drive-ra.
- **Deploy előtt, ha izgulsz:** egy gyors `pg_dump`, így egy paranccsal
  visszaállsz, ha bármi félresülne.

Így soha nem veszíthetsz többet néhány napnyi adatnál, a legrosszabb esetben
sem.
