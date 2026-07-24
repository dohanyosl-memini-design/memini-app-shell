// Riport-generálás: report.md (teljes, bizonyítékokkal) + eval-sheet.md
// (VAK értékelőlap: kevert sorrend, confidence és hipotézis-azonosító nélkül,
// hogy a megfogalmazás szépsége és a magabiztosság ne torzítsa a pontozást)
// + eval-key.json (a feloldókulcs — értékelés KÖZBEN nem nézzük).

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Hypothesis, Insight, RunConfig, RunMetrics } from './types'

// Determinisztikus keverés (seedelt LCG) — reprodukálható vak sorrend.
function shuffled<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed >>> 0
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function writeReports(
  outDir: string,
  config: RunConfig,
  metrics: RunMetrics,
  hypotheses: Hypothesis[],
  insights: Insight[],
) {
  // ── report.md — a teljes kép, futás után szabadon olvasható ──────────────
  const lines: string[] = []
  lines.push(`# Companion replay-backtest — ${config.runId}`)
  lines.push('')
  lines.push(`Provider: **${config.provider}** (${config.model}) · Export: \`${config.exportFile}\``)
  lines.push(`Időablak: ${config.fromDate ?? 'eleje'} → ${config.toDate ?? 'vége'}${config.maxDays ? ` (max ${config.maxDays} nap)` : ''}`)
  lines.push('')
  lines.push('## Futás-metrikák')
  lines.push('')
  lines.push(`| Metrika | Érték |`)
  lines.push(`|---|---|`)
  lines.push(`| Lefedett napok | ${metrics.days} |`)
  lines.push(`| Eseménynapok | ${metrics.daysWithEvents} |`)
  lines.push(`| Események | ${metrics.events} |`)
  lines.push(`| Observationök | ${metrics.observations} |`)
  lines.push(`| Született hipotézisek | ${metrics.hypothesesBorn} |`)
  lines.push(`| Megdőlt hipotézisek | ${metrics.hypothesesDisproved} |`)
  lines.push(`| Lejárt hipotézisek | ${metrics.hypothesesExpired} |`)
  lines.push(`| Megszólalások | ${metrics.insightsEmitted} |`)
  lines.push(`| **Zavarási ráta** | **${metrics.emissionsPerWeek} megszólalás/hét** |`)
  lines.push(`| LLM-hívások | ${metrics.llmCalls} |`)
  lines.push('')
  lines.push('## Megszólalások (időrendben)')
  lines.push('')
  for (const ins of insights) {
    const hyp = hypotheses.find(h => h.id === ins.hypothesisId)
    lines.push(`### ${ins.date} — ${ins.id}`)
    lines.push('')
    lines.push(`**Mit mondott volna:**`)
    lines.push('')
    lines.push(`> ${ins.text.replace(/\n/g, '\n> ')}`)
    lines.push('')
    lines.push(`**Miért (bizonyítékok):**`)
    for (const ev of ins.evidence) {
      lines.push(`- ${ev.date}${ev.companyName ? ` · ${ev.companyName}` : ''}: ${ev.text} \`${ev.observationId}\``)
    }
    lines.push('')
    lines.push(`**Confidence:** ${ins.confidence} (${ins.uniqueCompanies} független partner, ${ins.contraCount} ellenbizonyíték)`)
    lines.push('')
    lines.push(`**Mi cáfolná:** ${ins.falsifyCondition}`)
    lines.push('')
    lines.push(`**Miért pont most szól:** ${ins.whyNow}`)
    if (hyp) lines.push(`\n*Hipotézis-életút: ${hyp.bornOn} született → most: ${hyp.status}; confidence-történet: ${hyp.confidenceHistory.map(c => `${c.date}:${c.value}`).join(' → ') || '-'}*`)
    lines.push('')
  }
  if (!insights.length) lines.push('*(A rendszer egyszer sem szólalt meg az időablakban.)*\n')

  lines.push('## Hipotézis-lista (végállapot)')
  lines.push('')
  for (const h of hypotheses) {
    lines.push(`- **[${h.status}]** (conf ${h.confidence}) ${h.claim}`)
    lines.push(`  - Cáfolná: ${h.falsifyCondition}`)
    lines.push(`  - Támogató/cáfoló: ${h.supportingObservationIds.length}/${h.contradictingObservationIds.length} · született: ${h.bornOn} · lejár: ${h.expiresOn}`)
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'))

  // ── eval-sheet.md — vak értékelőlap ───────────────────────────────────────
  const order = shuffled(insights, config.seed)
  const sheet: string[] = []
  sheet.push('# Companion értékelőlap (VAK)')
  sheet.push('')
  sheet.push('A tételek kevert sorrendben, confidence nélkül szerepelnek — előbb pontozz, utána nyisd ki a report.md-t.')
  sheet.push('')
  sheet.push('Skála: `+2` hoppá, fontos, nem vettem észre · `+1` hasznos megerősítés · `0` igaz, de tudtam/érdektelen · `-1` zavaró/gyenge · `-2` téves/félrevezető')
  sheet.push('')
  sheet.push('Minden tételnél töltsd ki a `Pont:` sort, és ha tudod: `Újdonság (igen/nem)`, `Időben szólt? (igen/nem/késő)`.')
  sheet.push('')
  order.forEach((ins, i) => {
    sheet.push(`## Tétel ${i + 1}`)
    sheet.push('')
    sheet.push(`Dátum, amikor megszólalt volna: **${ins.date}**`)
    sheet.push('')
    sheet.push(`> ${ins.text.replace(/\n/g, '\n> ')}`)
    sheet.push('')
    sheet.push(`Hivatkozott bizonyítékok száma: ${ins.evidence.length}`)
    sheet.push('')
    sheet.push('```')
    sheet.push('Pont:        ')
    sheet.push('Újdonság:    ')
    sheet.push('Időben szólt:')
    sheet.push('Megjegyzés:  ')
    sheet.push('```')
    sheet.push('')
  })
  if (!order.length) sheet.push('*(Nincs értékelendő megszólalás.)*')
  fs.writeFileSync(path.join(outDir, 'eval-sheet.md'), sheet.join('\n'))

  // ── eval-key.json — feloldókulcs + pontozó-sablon a score.ts-nek ─────────
  fs.writeFileSync(path.join(outDir, 'eval-key.json'), JSON.stringify({
    note: 'Értékelés KÖZBEN ne nyisd ki. A scores mezőt töltsd ki a vak lap alapján (tételszám → pont).',
    items: order.map((ins, i) => ({
      item: i + 1, insightId: ins.id, hypothesisId: ins.hypothesisId,
      date: ins.date, confidence: ins.confidence,
    })),
    scores: Object.fromEntries(order.map((_, i) => [String(i + 1), null])),
  }, null, 2))
}
