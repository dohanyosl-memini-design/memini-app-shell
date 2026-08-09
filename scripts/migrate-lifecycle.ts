import { runLifecycleMigration } from '../src/lib/lifecycleMigration'
import { prisma } from '../src/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────
// Egyszeri életciklus-besorolás CLI-ből. A besorolás logikája a közös
// src/lib/lifecycleMigration.ts-ben él (ugyanazt használja a védett API-végpont
// is: /api/admin/migrate-lifecycle).
//
//   tsx scripts/migrate-lifecycle.ts            → riport (dry-run, nem ír)
//   tsx scripts/migrate-lifecycle.ts --write    → tényleges besorolás
//   tsx scripts/migrate-lifecycle.ts --write --all → minden céget újraértékel
// ─────────────────────────────────────────────────────────────────────────

const WRITE = process.argv.includes('--write')
const ALL = process.argv.includes('--all')

async function main() {
  console.log(`\n${WRITE ? '✍️  ÍRÁS MÓD' : '👀 DRY-RUN (add --write az íráshoz)'}${ALL ? ' — minden cég újraértékelése' : ''}\n`)

  const result = await runLifecycleMigration({ dryRun: !WRITE, all: ALL })

  for (const r of result.rows) {
    console.log(`  ${r.to.padEnd(13)} ← ${r.name}  (${r.reason})`)
  }

  console.log('\n── Összesítés ──')
  for (const [state, count] of Object.entries(result.tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${state.padEnd(13)} ${count}`)
  }
  console.log(`\n${result.total} cég ${WRITE ? 'besorolva.' : 'kapna új állapotot.'}`)
  if (!WRITE) console.log('Íráshoz: tsx scripts/migrate-lifecycle.ts --write')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
