// Companion replay-backtest — fő pipeline.
//
//   Historical events → Daily batch → Observation extraction → Observation
//   store → Hypothesis update → Insight emission decision → Evaluation report
//
// Futtatás:
//   npx tsx scripts/backtest/replay.ts --export exports/memini-export.json \
//     --provider anthropic --model claude-sonnet-5
//   npx tsx scripts/backtest/replay.ts --export scripts/backtest/fixtures/sample-export.json --provider mock
//
// Kapcsolók: --from YYYY-MM-DD, --to YYYY-MM-DD, --max-days N, --dry-run
// (csak eseménystatisztika, LLM-hívás nélkül), --out <dir>.

import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  ExportSnapshot, Hypothesis, Insight, Observation, RunConfig, RunMetrics,
} from './types'
import { buildEventStream, groupByDay } from './events'
import { computeConfidence, nextStatus, shouldEmit } from './confidence'
import { makeAdapter } from './llm'
import { writeReports } from './report'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}
const flag = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const exportFile = arg('export')
  if (!exportFile) {
    console.error('Használat: tsx scripts/backtest/replay.ts --export <fájl> [--provider anthropic|openai|mock] [--model <id>] [--from ...] [--to ...] [--max-days N] [--dry-run]')
    process.exit(1)
  }
  const provider = (arg('provider') ?? 'mock') as RunConfig['provider']
  const model = arg('model')
    ?? (provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-sonnet-5' : 'heuristic')
  const from = arg('from')
  const to = arg('to')
  const maxDays = arg('max-days') ? Number(arg('max-days')) : null
  const dryRun = flag('dry-run')

  const snap = JSON.parse(fs.readFileSync(exportFile, 'utf8')) as ExportSnapshot
  let events = buildEventStream(snap)
  if (from) events = events.filter(e => e.ts.slice(0, 10) >= from)
  if (to) events = events.filter(e => e.ts.slice(0, 10) <= to)

  const byDay = groupByDay(events)
  let days = Array.from(byDay.keys()).sort()
  if (maxDays) days = days.slice(0, maxDays)

  console.log(`Export: ${exportFile} (exportálva: ${snap.exportedAt}, anonim: ${snap.anonymized})`)
  console.log(`Események: ${events.length} db, ${days.length} eseménynapon (${days[0] ?? '-'} → ${days[days.length - 1] ?? '-'})`)

  if (dryRun) {
    const kinds = new Map<string, number>()
    for (const e of events) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1)
    console.log('\nEseménytípusok:')
    for (const [k, v] of Array.from(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
    return
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${provider}`
  const outDir = arg('out') ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'runs', runId)
  fs.mkdirSync(outDir, { recursive: true })

  const config: RunConfig = {
    runId, provider, model, exportFile,
    fromDate: from, toDate: to, maxDays,
    seed: 42, createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(outDir, 'config.json'), JSON.stringify(config, null, 2))

  const adapter = makeAdapter(provider, model)
  const observations: Observation[] = []
  const obsById = new Map<string, Observation>()
  const hypotheses: Hypothesis[] = []
  const insights: Insight[] = []
  let obsSeq = 0
  let hypSeq = 0
  let daysWithEvents = 0

  const obsStream = fs.createWriteStream(path.join(outDir, 'observations.jsonl'))
  const insStream = fs.createWriteStream(path.join(outDir, 'insights.jsonl'))

  for (const day of days) {
    const dayEvents = byDay.get(day)!
    daysWithEvents++

    // 1) Observation extraction — a nap eseményeiből, csak a mai napig látott világból.
    let drafts
    try {
      drafts = await adapter.extractObservations(day, dayEvents)
    } catch (err) {
      console.error(`  ${day}: extraction hiba, nap kihagyva — ${(err as Error).message}`)
      continue
    }
    const eventIds = new Set(dayEvents.map(e => e.id))
    const todaysObs: Observation[] = []
    for (const d of drafts) {
      const srcIds = (d.sourceEventIds ?? []).filter(id => eventIds.has(id))
      const srcEvents = dayEvents.filter(e => srcIds.includes(e.id))
      const obs: Observation = {
        id: `obs-${String(++obsSeq).padStart(5, '0')}`,
        date: day,
        text: String(d.text ?? '').slice(0, 500),
        companyId: d.companyId && snap.companies.some(c => c.id === d.companyId) ? d.companyId : null,
        companyName: null,
        sourceEventIds: srcIds,
        sourceKinds: Array.from(new Set(srcEvents.map(e => e.kind))),
      }
      obs.companyName = obs.companyId
        ? snap.companies.find(c => c.id === obs.companyId)?.name ?? null
        : null
      if (!obs.text.trim()) continue
      todaysObs.push(obs)
      observations.push(obs)
      obsById.set(obs.id, obs)
      obsStream.write(JSON.stringify(obs) + '\n')
    }

    // 2) Hipotézis-frissítés — besorolás, cáfolat-keresés, ritka új hipotézis.
    // A judge gördülő ablakot kap a közelmúlt observationjeiből (csak a mai
    // napIG — jövő-szivárgás nincs), mert a napokra elosztott minta egyetlen
    // nap megfigyeléseiből sosem állna össze.
    const windowStart = new Date(Date.parse(day) - 45 * 86400000).toISOString().slice(0, 10)
    const recentObs = observations
      .filter(o => o.date >= windowStart && o.date < day)
      .slice(-80)
    const active = hypotheses.filter(h => h.status !== 'disproved' && h.status !== 'expired')
    let judgement
    try {
      judgement = await adapter.judgeDay(day, todaysObs, recentObs, active)
    } catch (err) {
      console.error(`  ${day}: judge hiba, nap kihagyva — ${(err as Error).message}`)
      continue
    }

    for (const draft of judgement.newHypotheses ?? []) {
      // A falszifikációs feltétel kötelező — enélkül a hipotézis nem születhet meg.
      if (!draft.falsifyCondition?.trim() || !draft.claim?.trim()) continue
      if (hypotheses.some(h => h.claim === draft.claim)) continue
      const expiryDays = Math.min(Math.max(draft.expiryDays || 90, 14), 365)
      const bornWith = Array.from(new Set(draft.supportingObservationIds ?? []))
        .filter(id => obsById.has(id))
      hypotheses.push({
        id: `hyp-${String(++hypSeq).padStart(3, '0')}`,
        bornOn: day,
        claim: draft.claim.trim(),
        supportCondition: (draft.supportCondition ?? '').trim(),
        falsifyCondition: draft.falsifyCondition.trim(),
        expiresOn: new Date(Date.parse(day) + expiryDays * 86400000).toISOString().slice(0, 10),
        status: 'proposed',
        supportingObservationIds: bornWith,
        contradictingObservationIds: [],
        confidence: 0,
        confidenceHistory: [],
        emissions: 0,
        lastEmittedOn: null,
      })
    }

    const falsifyFlags = new Map<string, boolean>()
    for (const upd of judgement.updates ?? []) {
      const hyp = hypotheses.find(h => h.id === upd.hypothesisId)
      if (!hyp || hyp.status === 'disproved' || hyp.status === 'expired') continue
      for (const oid of upd.supportingObservationIds ?? []) {
        if (obsById.has(oid) && !hyp.supportingObservationIds.includes(oid)) {
          hyp.supportingObservationIds.push(oid)
        }
      }
      for (const oid of upd.contradictingObservationIds ?? []) {
        if (obsById.has(oid) && !hyp.contradictingObservationIds.includes(oid)) {
          hyp.contradictingObservationIds.push(oid)
        }
      }
      if (upd.falsifyConditionMet) falsifyFlags.set(hyp.id, true)
    }

    // 3) Determinisztikus confidence + státusz + megszólalási döntés.
    for (const hyp of hypotheses) {
      if (hyp.status === 'disproved' || hyp.status === 'expired') continue
      const cb = computeConfidence(hyp, obsById, day)
      const prevStatus = hyp.status
      const prevConf = hyp.confidence
      hyp.confidence = cb.value
      if (cb.value !== prevConf) hyp.confidenceHistory.push({ date: day, value: cb.value })
      hyp.status = nextStatus(hyp, cb, day, falsifyFlags.get(hyp.id) ?? false)

      const { emit, whyNow } = shouldEmit(hyp, prevStatus, hyp.status, cb, day)
      if (!emit) continue

      const evidence = hyp.supportingObservationIds
        .map(id => obsById.get(id)!)
        .filter(Boolean)
        .slice(-8)
      let text: string
      try {
        text = await adapter.phraseInsight(hyp, evidence, whyNow)
      } catch {
        text = hyp.claim
      }
      const insight: Insight = {
        id: `ins-${String(insights.length + 1).padStart(3, '0')}`,
        date: day,
        hypothesisId: hyp.id,
        text,
        whyNow,
        falsifyCondition: hyp.falsifyCondition,
        confidence: cb.value,
        evidence: evidence.map(o => ({
          observationId: o.id, date: o.date, text: o.text, companyName: o.companyName,
        })),
        uniqueCompanies: cb.uniqueCompanies,
        contraCount: cb.contra,
      }
      insights.push(insight)
      insStream.write(JSON.stringify(insight) + '\n')
      hyp.emissions++
      hyp.lastEmittedOn = day
      console.log(`  ${day} MEGSZÓLALÁS [${insight.id}] conf=${cb.value}: ${hyp.claim.slice(0, 80)}`)
    }

    if (todaysObs.length) {
      console.log(`  ${day}: ${dayEvents.length} esemény → ${todaysObs.length} observation, ${active.length} aktív hipotézis`)
    }
  }

  obsStream.end()
  insStream.end()
  fs.writeFileSync(path.join(outDir, 'hypotheses.json'), JSON.stringify(hypotheses, null, 2))

  const totalDays = days.length
    ? Math.max(1, (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86400000)
    : 1
  const metrics: RunMetrics = {
    days: totalDays,
    daysWithEvents,
    events: events.length,
    observations: observations.length,
    hypothesesBorn: hypotheses.length,
    hypothesesDisproved: hypotheses.filter(h => h.status === 'disproved').length,
    hypothesesExpired: hypotheses.filter(h => h.status === 'expired').length,
    insightsEmitted: insights.length,
    emissionsPerWeek: Math.round((insights.length / totalDays) * 7 * 100) / 100,
    llmCalls: adapter.calls,
  }
  fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2))

  writeReports(outDir, config, metrics, hypotheses, insights)

  console.log(`\nKész. Kimenet: ${outDir}`)
  console.log(`  ${metrics.observations} observation, ${metrics.hypothesesBorn} hipotézis, ${metrics.insightsEmitted} megszólalás (${metrics.emissionsPerWeek}/hét), ${metrics.llmCalls} LLM-hívás`)
  console.log('  Emberi értékeléshez: eval-sheet.md (vak sorrend), pontozás után: npx tsx scripts/backtest/score.ts --run ' + outDir)
}

main().catch(err => { console.error(err); process.exit(1) })
