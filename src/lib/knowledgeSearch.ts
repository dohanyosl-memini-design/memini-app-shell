import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Egységes keresés a cég tudásában: Brain-bejegyzések (döntés, tanulság, ötlet,
 * nyitott ügy), memóriák, aktivitások és levelek.
 *
 * Postgres beépített full-text keresésével dolgozik (`websearch_to_tsquery`), így
 * kifejezésre is lehet keresni idézőjellel, és kizárni is: `"éves vállalás" -minta`.
 * Emellett minden találatra megy egy ILIKE is, hogy a szótövezőn átcsúszó kódok
 * (cikkszám, rendelésszám) is előjöjjenek.
 *
 * Ekkora adatmennyiségnél (néhány ezer sor) a tsvector menet közben számolódik —
 * külön index nélkül is milliszekundumos. Ha egyszer kevés lesz, GIN indexet kell
 * tenni a kifejezésre; a séma nem változik tőle.
 */

export type KnowledgeScope = 'brain' | 'memory' | 'activity' | 'email'

export const KNOWLEDGE_SCOPES: KnowledgeScope[] = ['brain', 'memory', 'activity', 'email']

export interface KnowledgeHit {
  scope: KnowledgeScope
  id: string
  /** brain: kind (decision/…), memory: típuscímke, activity: típus, email: irány */
  kind: string
  title: string
  /** A találat környezete, a talált szavak **csillagozva** kiemelve. */
  snippet: string
  date: string | null
  status: string | null
  companyId: string | null
  companyName: string | null
  rank: number
}

export interface KnowledgeSearchOptions {
  query?: string
  scopes?: KnowledgeScope[]
  kind?: string
  companyId?: string
  contactId?: string
  status?: string
  /** YYYY-MM-DD — ettől a naptól */
  from?: string
  /** YYYY-MM-DD — eddig a napig (a nap egészét beleértve) */
  to?: string
  limit?: number
}

const HEADLINE_OPTS = 'StartSel=**, StopSel=**, MaxWords=32, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "'

/**
 * A magyar szótövező a Postgres alap-konfigurációi közt van, de ha egy telepítésből
 * hiányzik, a `simple` konfigurációra esünk vissza (szótövezés nélkül, de működik).
 * Egyszer derül ki, utána a folyamat élettartamáig megjegyezzük.
 */
let cachedConfig: string | null = null
async function ftsConfig(): Promise<string> {
  if (cachedConfig) return cachedConfig
  try {
    const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'hungarian') AS ok
    `
    cachedConfig = rows[0]?.ok ? 'hungarian' : 'simple'
  } catch {
    cachedConfig = 'simple'
  }
  return cachedConfig
}

interface RawHit {
  id: string
  kind: string | null
  title: string | null
  snippet: string | null
  date: Date | null
  status: string | null
  companyId: string | null
  companyName: string | null
  rank: number
}

function toHits(rows: RawHit[], scope: KnowledgeScope): KnowledgeHit[] {
  return rows.map(r => ({
    scope,
    id: r.id,
    kind: r.kind ?? '',
    title: (r.title ?? '').trim() || '(cím nélkül)',
    snippet: (r.snippet ?? '').replace(/\s+/g, ' ').trim(),
    date: r.date ? r.date.toISOString() : null,
    status: r.status,
    companyId: r.companyId,
    companyName: r.companyName,
    rank: Number(r.rank) || 0,
  }))
}

/** Keresési kifejezés → SQL töredékek. Üres kereséskor puszta szűrés/listázás. */
function matcher(config: string, text: Prisma.Sql, query?: string) {
  const q = query?.trim()
  if (!q) {
    return {
      where: Prisma.empty,
      rank: Prisma.sql`0::float4`,
      snippet: Prisma.sql`LEFT(${text}, 220)`,
    }
  }
  const like = `%${q}%`
  const tsq = Prisma.sql`websearch_to_tsquery(${config}::regconfig, ${q})`
  const tsv = Prisma.sql`to_tsvector(${config}::regconfig, ${text})`
  return {
    where: Prisma.sql`AND (${tsv} @@ ${tsq} OR ${text} ILIKE ${like})`,
    rank: Prisma.sql`ts_rank(${tsv}, ${tsq})`,
    snippet: Prisma.sql`ts_headline(${config}::regconfig, ${text}, ${tsq}, ${HEADLINE_OPTS})`,
  }
}

function dateRange(col: Prisma.Sql, from?: string, to?: string) {
  const parts: Prisma.Sql[] = []
  if (from) parts.push(Prisma.sql`AND ${col} >= ${new Date(`${from}T00:00:00`)}`)
  if (to) parts.push(Prisma.sql`AND ${col} <= ${new Date(`${to}T23:59:59.999`)}`)
  return parts.length ? Prisma.join(parts, ' ') : Prisma.empty
}

function eq(col: Prisma.Sql, value?: string) {
  return value ? Prisma.sql`AND ${col} = ${value}` : Prisma.empty
}

async function searchBrain(config: string, o: KnowledgeSearchOptions, limit: number) {
  // A details JSON-ból csak az ÉRTÉKEK kerülnek a keresett szövegbe — a mezőnevek
  // ("reason", "blocker") nem keresendők, és nyers JSON-t sem akarunk a kivonatban.
  const text = Prisma.sql`(
    b.title || ' ' || b.content || ' ' ||
    COALESCE((SELECT string_agg(d.value, ' ') FROM jsonb_each_text(b.details) d), '')
  )`
  const m = matcher(config, text, o.query)
  const rows = await prisma.$queryRaw<RawHit[]>`
    SELECT b.id,
           b.kind                                  AS kind,
           b.title                                 AS title,
           ${m.snippet}                            AS snippet,
           COALESCE(b."eventDate", b."createdAt")  AS date,
           b.status                                AS status,
           b."companyId"                           AS "companyId",
           c.name                                  AS "companyName",
           ${m.rank}                               AS rank
    FROM "BrainNote" b
    LEFT JOIN "Company" c ON c.id = b."companyId"
    WHERE TRUE
      ${m.where}
      ${eq(Prisma.sql`b.kind`, o.kind)}
      ${eq(Prisma.sql`b."companyId"`, o.companyId)}
      ${eq(Prisma.sql`b."contactId"`, o.contactId)}
      ${eq(Prisma.sql`b.status`, o.status)}
      ${dateRange(Prisma.sql`COALESCE(b."eventDate", b."createdAt")`, o.from, o.to)}
    ORDER BY rank DESC, date DESC
    LIMIT ${limit}
  `
  return toHits(rows, 'brain')
}

async function searchMemory(config: string, o: KnowledgeSearchOptions, limit: number) {
  const text = Prisma.sql`m.content`
  const m = matcher(config, text, o.query)
  const rows = await prisma.$queryRaw<RawHit[]>`
    SELECT m.id,
           mt.label                              AS kind,
           LEFT(m.content, 90)                   AS title,
           ${m.snippet}                          AS snippet,
           COALESCE(m.date, m."createdAt")       AS date,
           m.source                              AS status,
           m."companyId"                         AS "companyId",
           c.name                                AS "companyName",
           ${m.rank}                             AS rank
    FROM "MemoryEntry" m
    JOIN "MemoryEntryType" mt ON mt.id = m."typeId"
    LEFT JOIN "Company" c ON c.id = m."companyId"
    WHERE TRUE
      ${m.where}
      ${eq(Prisma.sql`m."companyId"`, o.companyId)}
      ${eq(Prisma.sql`m."contactId"`, o.contactId)}
      ${dateRange(Prisma.sql`COALESCE(m.date, m."createdAt")`, o.from, o.to)}
    ORDER BY rank DESC, date DESC
    LIMIT ${limit}
  `
  return toHits(rows, 'memory')
}

async function searchActivity(config: string, o: KnowledgeSearchOptions, limit: number) {
  const text = Prisma.sql`(COALESCE(a.subject, '') || ' ' || a.description || ' ' || COALESCE(a.outcome, ''))`
  const m = matcher(config, text, o.query)
  const rows = await prisma.$queryRaw<RawHit[]>`
    SELECT a.id,
           a.type                                        AS kind,
           COALESCE(NULLIF(a.subject, ''), LEFT(a.description, 90)) AS title,
           ${m.snippet}                                  AS snippet,
           a."activityDate"                              AS date,
           a.outcome                                     AS status,
           a."companyId"                                 AS "companyId",
           c.name                                        AS "companyName",
           ${m.rank}                                     AS rank
    FROM "Activity" a
    LEFT JOIN "Company" c ON c.id = a."companyId"
    WHERE TRUE
      ${m.where}
      ${eq(Prisma.sql`a.type`, o.kind)}
      ${eq(Prisma.sql`a."companyId"`, o.companyId)}
      ${eq(Prisma.sql`a."contactId"`, o.contactId)}
      ${dateRange(Prisma.sql`a."activityDate"`, o.from, o.to)}
    ORDER BY rank DESC, date DESC
    LIMIT ${limit}
  `
  return toHits(rows, 'activity')
}

async function searchEmail(config: string, o: KnowledgeSearchOptions, limit: number) {
  // A tsvector mérete korlátos (1 MB), egy hosszú levéllánc pedig átlépheti —
  // ezért a levéltörzs a keresésbe csak levágva kerül bele.
  const text = Prisma.sql`(e.subject || ' ' || LEFT(e."textBody", 100000))`
  const m = matcher(config, text, o.query)
  const rows = await prisma.$queryRaw<RawHit[]>`
    SELECT e.id,
           e.direction              AS kind,
           e.subject                AS title,
           ${m.snippet}             AS snippet,
           e."sentAt"               AS date,
           t."replyStatus"          AS status,
           t."companyId"            AS "companyId",
           c.name                   AS "companyName",
           ${m.rank}                AS rank
    FROM "Email" e
    JOIN "EmailThread" t ON t.id = e."threadId"
    LEFT JOIN "Company" c ON c.id = t."companyId"
    WHERE e.category <> 'spam'
      ${m.where}
      ${eq(Prisma.sql`e.direction`, o.kind)}
      ${eq(Prisma.sql`t."companyId"`, o.companyId)}
      ${eq(Prisma.sql`t."contactId"`, o.contactId)}
      ${dateRange(Prisma.sql`e."sentAt"`, o.from, o.to)}
    ORDER BY rank DESC, date DESC
    LIMIT ${limit}
  `
  return toHits(rows, 'email')
}

export async function searchKnowledge(o: KnowledgeSearchOptions): Promise<KnowledgeHit[]> {
  const limit = Math.min(Math.max(o.limit ?? 25, 1), 100)
  const scopes = o.scopes?.length ? o.scopes : KNOWLEDGE_SCOPES
  const config = await ftsConfig()

  // Scope-onként a teljes limitet kérjük, a rangsorolás utána közösen dől el.
  const runners: Promise<KnowledgeHit[]>[] = []
  if (scopes.includes('brain')) runners.push(searchBrain(config, o, limit))
  if (scopes.includes('memory')) runners.push(searchMemory(config, o, limit))
  if (scopes.includes('activity')) runners.push(searchActivity(config, o, limit))
  if (scopes.includes('email')) runners.push(searchEmail(config, o, limit))

  const results = (await Promise.all(runners)).flat()

  // Keresésnél relevancia dönt, azon belül a frissebb elöl; üres keresésnél
  // (minden rank 0) ez tiszta időrendi listázássá egyszerűsödik.
  results.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank
    return (b.date ?? '').localeCompare(a.date ?? '')
  })
  return results.slice(0, limit)
}
