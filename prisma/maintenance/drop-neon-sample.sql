-- A Neon onboarding minta-táblája (`playing_with_neon`) sosem volt a Prisma
-- sémában, ezért a `prisma db push` az első valódi migrációnál le akarta dobni,
-- és a --accept-data-loss hiányában megbuktatta a buildet (deploy 2026-09-03).
--
-- Itt egyszer, biztonságosan eldobjuk. Az IF EXISTS miatt idempotens: a tábla
-- eltűnése után minden további buildnél no-op. Semmilyen valós CRM-adathoz nincs
-- köze — a Neon quickstart hozta létre 10 sor minta-adattal.
DROP TABLE IF EXISTS playing_with_neon;
