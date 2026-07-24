// Modell-adapter: anthropic | openai | mock.
//
// A cél a RENDSZER validálása, nem egy modellé — ezért a provider cserélhető,
// és ugyanaz a replay lefuttatható GPT-vel és Claude-dal is, összehasonlításra.
// A mock provider determinisztikus kulcsszó-heurisztika: API-kulcs nélkül
// végigtesztelhető vele a teljes csővezeték.

import type { Hypothesis, Observation, RawEvent } from './types'

export interface ObservationDraft {
  text: string
  companyId: string | null
  sourceEventIds: string[]
}

export interface HypothesisDraft {
  claim: string
  supportCondition: string
  falsifyCondition: string
  expiryDays: number
  // A gördülő ablakból már most támogató observationök — így a napokra
  // elosztva született minta a hipotézis születésekor visszamenőleg is linkel.
  supportingObservationIds?: string[]
}

export interface HypothesisUpdate {
  hypothesisId: string
  supportingObservationIds: string[]
  contradictingObservationIds: string[]
  falsifyConditionMet: boolean
}

export interface DayJudgement {
  newHypotheses: HypothesisDraft[]
  updates: HypothesisUpdate[]
}

export interface LlmAdapter {
  name: string
  calls: number
  extractObservations(day: string, events: RawEvent[]): Promise<ObservationDraft[]>
  // recentObservations: gördülő ablak (a mai napIG, jövő-szivárgás nélkül) —
  // enélkül a napokra elosztott minta sosem állna össze hipotézissé.
  judgeDay(
    day: string,
    todaysObservations: Observation[],
    recentObservations: Observation[],
    activeHypotheses: Hypothesis[],
  ): Promise<DayJudgement>
  phraseInsight(hyp: Hypothesis, evidence: Observation[], whyNow: string): Promise<string>
}

// ─── Promptok ────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `A Memini Design (német B2B szuvenír/hűtőmágnes gyártó) céges eseményeiből készítesz megfigyeléseket.

SZABÁLYOK:
1. Csak TÉNYSZERŰ megfigyelést írj, interpretáció nélkül. Jó: "X partner kisebb minimum rendelést kért." Rossz: "X partner bizonytalankodik."
2. Ne ismételd el nyersen az eseményt — azt emeld ki, ami egy vezetőnek jelentés-hordozó lehet (igény, panasz, preferencia, viselkedésváltozás, szokatlan érték).
3. Rutinesemény (sima admin, jelentéktelen mozgás) → NE csinálj belőle megfigyelést. Kevesebb, jobb megfigyelés kell.
4. A "stateAsOfExport" jelölésű események mai állapotot tükrözhetnek — az ilyenekből csak a létrejöttük tényére építs, a részleteikre óvatosan.
5. Minden megfigyeléshez add meg a forrás-esemény(ek) id-jét.

Válasz KIZÁRÓLAG JSON tömb:
[{"text": "...", "companyId": "..." | null, "sourceEventIds": ["ev-000123"]}]
Ha nincs érdemi megfigyelés: []`

const JUDGE_SYSTEM = `A Memini Companion hipotézis-karbantartó lépése vagy. Kapod a mai megfigyeléseket, a közelmúlt megfigyelés-ablakát (kontextus) és az aktív hipotéziseket.

FELADATOK:
1. BESOROLÁS: minden MAI megfigyelésről döntsd el, támogat-e vagy cáfol-e valamely aktív hipotézist (a legtöbb megfigyelés egyiket sem — az normális).
2. CÁFOLAT-ELLENŐRZÉS: hipotézisenként jelezd, ha a falsifyCondition a mai napig teljesült. AKTÍVAN keresd a cáfolatot, ne csak a támogatást.
3. ÚJ HIPOTÉZIS: csak akkor javasolj, ha a közelmúlt-ablakban LEGALÁBB KÉT KÜLÖNBÖZŐ partnertől/forrásból látszik ugyanaz a minta, és a minta döntésre alkalmas lehet. Ritkán szüless hipotézis — a zaj drágább, mint a késés. Az új hipotézishez add meg az ablakból a már most támogató megfigyelések id-jét (supportingObservationIds).
   Minden új hipotézis KÖTELEZŐEN tartalmaz falszifikációs feltételt (mi cáfolná) és lejáratot (expiryDays, tipikusan 60-120).

Válasz KIZÁRÓLAG JSON:
{"newHypotheses": [{"claim": "...", "supportCondition": "...", "falsifyCondition": "...", "expiryDays": 90, "supportingObservationIds": ["obs-00001"]}],
 "updates": [{"hypothesisId": "...", "supportingObservationIds": [], "contradictingObservationIds": [], "falsifyConditionMet": false}]}`

const PHRASE_SYSTEM = `A Memini Companion vagy — Laci üzleti társa. Egy megerősödött hipotézisből fogalmazol egy rövid megszólalást (2-4 mondat, magyarul, közvetlen hangon, "Laci" megszólítással kezdve). Tényekre hivatkozz, ne túlozz, a bizonytalanságot ne rejtsd el. Csak a megszólalás szövegét add vissza, semmi mást.`

// ─── JSON-parszolás védőháló ─────────────────────────────────────────────────

function parseJson<T>(text: string, fallback: T): T {
  const stripped = text.replace(/```(?:json)?/g, '').trim()
  const start = Math.min(
    ...['[', '{'].map(ch => { const i = stripped.indexOf(ch); return i === -1 ? Infinity : i }),
  )
  if (!Number.isFinite(start)) return fallback
  const end = Math.max(stripped.lastIndexOf(']'), stripped.lastIndexOf('}'))
  if (end <= start) return fallback
  try { return JSON.parse(stripped.slice(start, end + 1)) as T } catch { return fallback }
}

// ─── Közös prompt-építők ─────────────────────────────────────────────────────

function buildExtractUser(day: string, events: RawEvent[]): string {
  return `Dátum: ${day}\n\nMai események:\n${events.map(e =>
    `[${e.id}] (${e.kind}${e.stateAsOfExport ? ', stateAsOfExport' : ''})${e.companyName ? ` {companyId: ${e.companyId}, cég: ${e.companyName}}` : ''} ${e.summary}`,
  ).join('\n')}`
}

function buildJudgeUser(
  day: string, todays: Observation[], recent: Observation[], hyps: Hypothesis[],
): string {
  const fmt = (o: Observation) => `[${o.id}] ${o.date}${o.companyName ? ` (${o.companyName})` : ''} ${o.text}`
  return `Dátum: ${day}

MAI MEGFIGYELÉSEK:
${todays.map(fmt).join('\n') || '(nincs)'}

KÖZELMÚLT-ABLAK (korábbi megfigyelések, kontextus a mintázatokhoz):
${recent.map(fmt).join('\n') || '(nincs)'}

AKTÍV HIPOTÉZISEK:
${hyps.map(h => `[${h.id}] (${h.status}, conf ${h.confidence}) ÁLLÍTÁS: ${h.claim} | CÁFOLNÁ: ${h.falsifyCondition}`).join('\n') || '(nincs)'}`
}

function buildPhraseUser(hyp: Hypothesis, evidence: Observation[], whyNow: string): string {
  return `Hipotézis: ${hyp.claim}\nConfidence: ${hyp.confidence}\nMiért most: ${whyNow}\nBizonyítékok:\n${evidence.map(o => `- ${o.date}${o.companyName ? ` (${o.companyName})` : ''}: ${o.text}`).join('\n')}`
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

class AnthropicAdapter implements LlmAdapter {
  name: string
  calls = 0
  private client: import('@anthropic-ai/sdk').default | null = null
  constructor(private model: string) { this.name = `anthropic:${model}` }

  private async complete(system: string, user: string): Promise<string> {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }
    this.calls++
    const res = await this.client.messages.create({
      model: this.model, max_tokens: 3000, system,
      messages: [{ role: 'user', content: user }],
    })
    const block = res.content[0]
    return block && block.type === 'text' ? block.text : ''
  }

  async extractObservations(day: string, events: RawEvent[]) {
    return parseJson<ObservationDraft[]>(
      await this.complete(EXTRACT_SYSTEM, buildExtractUser(day, events)), [])
  }

  async judgeDay(day: string, todays: Observation[], recent: Observation[], hyps: Hypothesis[]) {
    return parseJson<DayJudgement>(
      await this.complete(JUDGE_SYSTEM, buildJudgeUser(day, todays, recent, hyps)),
      { newHypotheses: [], updates: [] })
  }

  async phraseInsight(hyp: Hypothesis, evidence: Observation[], whyNow: string) {
    const text = await this.complete(PHRASE_SYSTEM, buildPhraseUser(hyp, evidence, whyNow))
    return text.trim() || hyp.claim
  }
}

// ─── OpenAI (fetch, függőség nélkül) ─────────────────────────────────────────

class OpenAiAdapter implements LlmAdapter {
  name: string
  calls = 0
  constructor(private model: string) { this.name = `openai:${model}` }

  private async complete(system: string, user: string): Promise<string> {
    this.calls++
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.model, max_tokens: 3000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }

  async extractObservations(day: string, events: RawEvent[]) {
    return parseJson<ObservationDraft[]>(
      await this.complete(EXTRACT_SYSTEM, buildExtractUser(day, events)), [])
  }

  async judgeDay(day: string, todays: Observation[], recent: Observation[], hyps: Hypothesis[]) {
    return parseJson<DayJudgement>(
      await this.complete(JUDGE_SYSTEM, buildJudgeUser(day, todays, recent, hyps)),
      { newHypotheses: [], updates: [] })
  }

  async phraseInsight(hyp: Hypothesis, evidence: Observation[], whyNow: string) {
    const text = await this.complete(PHRASE_SYSTEM, buildPhraseUser(hyp, evidence, whyNow))
    return text.trim() || hyp.claim
  }
}

// ─── Mock — determinisztikus, kulcs nélküli csővezeték-teszt ─────────────────

const MOCK_PATTERNS: { key: string; re: RegExp; claim: string; falsify: string; support: string }[] = [
  {
    key: 'moq',
    re: /\b(moq|minimum rendel|kisebb (kezdő)?rendel|mindestbestell)/i,
    claim: 'A partnerek egyre gyakrabban kérnek kisebb minimum rendelési mennyiséget (MOQ).',
    support: 'Legalább 4 különböző partner említi 60 napon belül.',
    falsify: 'A következő 15 releváns partner-interakcióból legfeljebb 1 említ kisebb MOQ-igényt.',
  },
  {
    key: 'exclusiv',
    re: /exkluzivit|exklusiv/i,
    claim: 'A helyi exkluzivitás visszatérő, döntést befolyásoló igény a partnereknél.',
    support: 'Legalább 3 különböző partner hangsúlyozza 90 napon belül.',
    falsify: 'A következő 10 új partner-tárgyalásból egyik sem hozza fel az exkluzivitást.',
  },
  {
    key: 'payment',
    re: /fizetési késés|lejárt számla|mahnung|nem fizetett/i,
    claim: 'A fizetési fegyelem romlik a partnerkörben.',
    support: 'A lejárt számlák aránya 30 napon át emelkedik.',
    falsify: 'A következő 30 napban a számlák legalább 90%-a határidőre kifizetésre kerül.',
  },
]

class MockAdapter implements LlmAdapter {
  name = 'mock'
  calls = 0

  async extractObservations(_day: string, events: RawEvent[]) {
    const out: ObservationDraft[] = []
    for (const ev of events) {
      for (const p of MOCK_PATTERNS) {
        if (p.re.test(ev.summary)) {
          out.push({
            text: `${ev.companyName ?? 'Ismeretlen partner'}: ${ev.summary.slice(0, 160)} [minta: ${p.key}]`,
            companyId: ev.companyId,
            sourceEventIds: [ev.id],
          })
          break
        }
      }
    }
    return out
  }

  async judgeDay(_day: string, todays: Observation[], recent: Observation[], hyps: Hypothesis[]) {
    const judgement: DayJudgement = { newHypotheses: [], updates: [] }
    for (const p of MOCK_PATTERNS) {
      const tag = `[minta: ${p.key}]`
      const todayMatches = todays.filter(o => o.text.includes(tag))
      if (!todayMatches.length) continue
      const existing = hyps.find(h => h.claim === p.claim)
      if (existing) {
        judgement.updates.push({
          hypothesisId: existing.id,
          supportingObservationIds: todayMatches.map(o => o.id),
          contradictingObservationIds: [],
          falsifyConditionMet: false,
        })
      } else {
        // Új hipotézis csak 2+ független forrásnál a teljes ablakban —
        // mint az éles promptban.
        const windowMatches = [...recent, ...todayMatches].filter(o => o.text.includes(tag))
        const companies = new Set(windowMatches.map(o => o.companyId).filter(Boolean))
        if (companies.size >= 2) {
          judgement.newHypotheses.push({
            claim: p.claim, supportCondition: p.support,
            falsifyCondition: p.falsify, expiryDays: 90,
            supportingObservationIds: windowMatches.map(o => o.id),
          })
        }
      }
    }
    return judgement
  }

  async phraseInsight(hyp: Hypothesis, evidence: Observation[], whyNow: string) {
    return `Laci. ${hyp.claim} Az elmúlt időszakban ${evidence.length} megfigyelés támasztja alá (${whyNow})`
  }
}

export function makeAdapter(provider: string, model: string): LlmAdapter {
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY hiányzik')
    return new AnthropicAdapter(model)
  }
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY hiányzik')
    return new OpenAiAdapter(model)
  }
  if (provider === 'mock') return new MockAdapter()
  throw new Error(`Ismeretlen provider: ${provider} (anthropic | openai | mock)`)
}
