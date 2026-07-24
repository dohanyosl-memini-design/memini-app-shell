// Companion Value Score — a kitöltött eval-key.json scores mezőjéből.
//
//   CVS = Σ pozitív pontok
//       − zavarási költség (0 és −1 tételek után 0.5, ill. 1)
//       − téves állítások súlyozott büntetése (−2 tétel: 2 + 2×confidence —
//         a MAGABIZTOS tévedés büntetése a legnagyobb)
//
// Futtatás: npx tsx scripts/backtest/score.ts --run scripts/backtest/runs/<runId>

import * as fs from 'node:fs'
import * as path from 'node:path'

const i = process.argv.indexOf('--run')
const runDir = i !== -1 ? process.argv[i + 1] : null
if (!runDir) { console.error('Használat: tsx scripts/backtest/score.ts --run <run-könyvtár>'); process.exit(1) }

interface EvalKey {
  items: { item: number; insightId: string; date: string; confidence: number }[]
  scores: Record<string, number | null>
}
const key = JSON.parse(fs.readFileSync(path.join(runDir, 'eval-key.json'), 'utf8')) as EvalKey

let positive = 0, interruption = 0, falsePenalty = 0
let scored = 0
const rows: string[] = []

for (const item of key.items) {
  const score = key.scores[String(item.item)]
  if (score === null || score === undefined) continue
  scored++
  let contribution = 0
  if (score > 0) { positive += score; contribution = score }
  else if (score === 0) { interruption += 0.5; contribution = -0.5 }
  else if (score === -1) { interruption += 1; contribution = -1 }
  else if (score <= -2) {
    const p = 2 + 2 * (item.confidence ?? 0)
    falsePenalty += p
    contribution = -p
  }
  rows.push(`  Tétel ${item.item} (${item.insightId}, ${item.date}, conf ${item.confidence}): pont ${score} → ${contribution >= 0 ? '+' : ''}${contribution.toFixed(1)}`)
}

if (!scored) {
  console.log('Még nincs kitöltött pontszám az eval-key.json "scores" mezőjében.')
  process.exit(0)
}

const cvs = positive - interruption - falsePenalty
console.log(`Értékelt tételek: ${scored}/${key.items.length}\n`)
console.log(rows.join('\n'))
console.log(`\nPozitív találatok:        +${positive.toFixed(1)}`)
console.log(`Zavarási költség:         -${interruption.toFixed(1)}`)
console.log(`Téves állítás büntetés:   -${falsePenalty.toFixed(1)}`)
console.log(`\nCompanion Value Score:    ${cvs >= 0 ? '+' : ''}${cvs.toFixed(1)}`)
console.log(`\nSikerkritérium (README): CVS > 0 ÉS legalább egy +2-es tétel ÉS zavarási ráta ≤ 3/hét.`)
