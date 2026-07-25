// IMAP → CRM levél-szinkron futtatója. A cPanel cron ezt hívja 5 percenként,
// --once módban. A titkok (IMAP-jelszó/OAuth) a cPanel env-változóiban élnek.
//
// Használat:
//   npx tsx scripts/email-sync.ts --once            # egy ciklus (cronhoz)
//   npx tsx scripts/email-sync.ts --backfill 1000   # kezdeti behúzás, nagyobb limittel
//
// cPanel cron (5 percenként), a bridge worker HELYETT:
//   */5 * * * * cd /path/to/app && npx tsx scripts/email-sync.ts --once >> sync.log 2>&1

import { PrismaClient } from '@prisma/client'
import { EmailSyncService } from '../src/lib/email/sync'
import { loadSyncConfig } from '../src/lib/email/syncConfig'

function argNum(name: string): number | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : undefined
}

async function main() {
  const backfill = argNum('backfill')
  const config = loadSyncConfig()
  const prisma = new PrismaClient()
  const log = (msg: string, extra?: Record<string, unknown>) =>
    console.log(`[${new Date().toISOString()}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`)

  const service = new EmailSyncService(prisma, config, log)
  try {
    log('Szinkron indul', { host: config.host, user: config.user, mode: config.authMode, backfill: backfill ?? config.initialSyncLimit })
    const count = await service.syncOnce({ backfillLimit: backfill })
    log('Szinkron kész', { újFeldolgozott: count })
  } catch (e) {
    log('Szinkron hiba', { err: e instanceof Error ? e.message : String(e) })
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
