import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { createBrainNote } from '@/lib/brain'
import { buildSequenceFromTemplate, parseSequence } from '@/lib/emailSequence'

// ─────────────────────────────────────────────────────────────────────────
// A cég-életciklus egyetlen forrása. Se az API, se az MCP nem írja kézzel a
// Company.lifecycle mezőt — mindenki a transitionCompany()-t hívja, ami egy
// tranzakcióban frissíti a céget ÉS naplózza a váltást (LifecycleEvent).
// ─────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_STATES = [
  'prospect',
  'cold_lead',
  'warm_lead',
  'interested',
  'partner',
  'inactive',
  'lost_lead',
  'lost_partner',
] as const

export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  prospect:     'Prospekt',
  cold_lead:    'Hideg lead',
  warm_lead:    'Meleg lead',
  interested:   'Érdeklődő',
  partner:      'Partner',
  inactive:     'Inaktív',
  lost_lead:    'Elvesztett lead',
  lost_partner: 'Elvesztett partner',
}

// A három nézet szűrői. Egy állapot pontosan egy nézethez tartozik.
// Lead-ág melegség szerint: prospekt → hideg → meleg (feliratkozott, sorozatot
// kap) → érdeklődő (mintát kért).
export const LEAD_STATES: LifecycleState[] = ['prospect', 'cold_lead', 'warm_lead', 'interested']
export const PARTNER_STATES: LifecycleState[] = ['partner', 'inactive']
export const LOST_STATES: LifecycleState[] = ['lost_lead', 'lost_partner']

// Elvesztettbe csak kötelező indokkal lehet lépni (UI-n felugró ablak,
// MCP-n kötelező paraméter). Ez a minimum hossz — az „x" vagy „nem" nem indok.
export const MIN_REASON_LENGTH = 10

// Inaktivitási küszöb: ennyi hónap után JAVASOLJUK az inaktívra léptetést
// (nem automatikus — egy szezonálisan zárva tartó kastély is élő partner lehet).
export const INACTIVE_AFTER_MONTHS = 12

export function isLostState(state: string): boolean {
  return (LOST_STATES as string[]).includes(state)
}

export function requiresReason(to: string): boolean {
  return isLostState(to)
}

// Megengedett átmenetek. Az aktív állapotok között szabadon lehet mozogni
// (előre és vissza is), mert a felhasználó kézzel bármikor a helyes lépcsőfokra
// állíthat — nem kell végigkattintania a fokokat. A temetőbe (lost_*) lépés a
// megfelelő elvesztett állapotot kapja, és mindig kötelező indokkal jár.
// A kulcs a forrásállapot, az érték a megengedett célállapotok halmaza.
const ACTIVE: LifecycleState[] = ['prospect', 'cold_lead', 'warm_lead', 'interested', 'partner', 'inactive']
const others = (self: LifecycleState) => ACTIVE.filter((s) => s !== self)

const TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  prospect:     [...others('prospect'), 'lost_lead'],
  cold_lead:    [...others('cold_lead'), 'lost_lead'],
  warm_lead:    [...others('warm_lead'), 'lost_lead'],
  interested:   [...others('interested'), 'lost_lead'],
  partner:      [...others('partner'), 'lost_partner'],
  inactive:     [...others('inactive'), 'lost_partner'],
  // Temetőből visszahozás bármely aktív állapotba.
  lost_lead:    [...ACTIVE],
  lost_partner: [...ACTIVE],
}

export function canTransition(from: string, to: string): boolean {
  if (!(LIFECYCLE_STATES as readonly string[]).includes(to)) return false
  if (from === to) return false
  const allowed = TRANSITIONS[from as LifecycleState]
  return allowed ? (allowed as string[]).includes(to) : false
}

export type LifecycleSource = 'ui' | 'mcp' | 'auto' | 'migration'

export class LifecycleError extends Error {
  code: 'invalid_transition' | 'reason_required' | 'not_found' | 'invalid_state'
  constructor(code: LifecycleError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'LifecycleError'
  }
}

interface TransitionInput {
  companyId: string
  to: LifecycleState | string
  reason?: string | null
  source: LifecycleSource
  actor?: string | null
  /** true = a hívó már ellenőrizte az átmenetet (pl. migráció/auto), a
   *  megengedettségi vizsgálatot átugorjuk. Az indok-kötelezettséget NEM. */
  force?: boolean
}

/**
 * Egyetlen belépési pont a cég életciklusának módosítására. Tranzakcióban
 * frissíti a Company mezőit és ír egy LifecycleEvent naplóbejegyzést.
 * Hibát dob (LifecycleError), ha az átmenet tiltott vagy hiányzik a kötelező indok.
 */
export async function transitionCompany(input: TransitionInput) {
  const { companyId, to, source, force } = input
  const reason = input.reason?.trim() || null
  const actor = input.actor?.trim() || null

  if (!(LIFECYCLE_STATES as readonly string[]).includes(to)) {
    throw new LifecycleError('invalid_state', `Ismeretlen életciklus-állapot: ${to}`)
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, lifecycle: true, name: true, emailSequence: true },
  })
  if (!company) {
    throw new LifecycleError('not_found', 'Cég nem található.')
  }

  const from = company.lifecycle

  if (from === to) {
    // Nincs teendő — visszaadjuk a céget változatlanul.
    return { company, changed: false as const }
  }

  if (!force && !canTransition(from, to)) {
    throw new LifecycleError(
      'invalid_transition',
      `Nem megengedett átmenet: ${LIFECYCLE_LABELS[from as LifecycleState] ?? from} → ${LIFECYCLE_LABELS[to as LifecycleState] ?? to}`
    )
  }

  if (requiresReason(to) && (!reason || reason.length < MIN_REASON_LENGTH)) {
    throw new LifecycleError(
      'reason_required',
      `Az elvesztettbe léptetéshez kötelező az indok (legalább ${MIN_REASON_LENGTH} karakter).`
    )
  }

  const lost = isLostState(to)

  const data: Prisma.CompanyUpdateInput = {
    lifecycle: to,
    lifecycleSince: new Date(),
    lostReason: lost ? reason : null,
    lostAt: lost ? new Date() : null,
  }

  const [updated] = await prisma.$transaction([
    prisma.company.update({ where: { id: companyId }, data }),
    prisma.lifecycleEvent.create({
      data: { companyId, fromState: from, toState: to, reason, source, actor },
    }),
  ])

  // Meleg leaddé váláskor a kézi email-sorozat kiosztódik a sablonból — de csak
  // ha még nincs neki (nem írjuk felül a kézzel szerkesztett sorozatot).
  if (to === 'warm_lead') {
    const existing = parseSequence(company.emailSequence)
    if (!existing || existing.steps.length === 0) {
      try {
        await prisma.company.update({
          where: { id: companyId },
          data: { emailSequence: buildSequenceFromTemplate() as unknown as Prisma.InputJsonValue },
        })
      } catch { /* a sorozat-kiosztás hibája nem érinti a léptetést */ }
    }
  }

  // Temetőbe kerülés → setback a Brainbe, hogy a heti trendben látszódjon, ha
  // sorozatban veszítünk. Best-effort: soha ne bukjon el rajta a léptetés.
  if (lost) {
    try {
      await createBrainNote({
        kind: 'setback',
        title: `Elvesztett ${to === 'lost_partner' ? 'partner' : 'lead'}: ${company.name}`,
        content: reason || 'Nincs megadott indok.',
        companyId,
        source: 'auto',
        importance: to === 'lost_partner' ? 3 : 2,
      })
    } catch { /* a Brain-bejegyzés hibája nem érinti az életciklust */ }
  }

  return { company: updated, changed: true as const, from, to }
}

/**
 * Partnerré léptetés az első rendeléskor. A felület, az MCP create_order és a
 * convert_quote_to_order MIND ezt hívja — így egyetlen helyen van a szabály,
 * hogy „partnerré az első rendelés tesz". Ha a cég már partner, nem csinál
 * semmit; ha inaktív volt, visszahozza aktív partnerré.
 *
 * Nem dob hibát a hívó felé — a rendelés rögzítése soha ne bukjon el azon,
 * hogy az életciklus-léptetés elakadt.
 */
export async function promoteToPartnerIfNeeded(
  companyId: string | null | undefined,
  source: LifecycleSource,
  actor?: string | null
): Promise<void> {
  if (!companyId) return
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { lifecycle: true, firstOrderDate: true },
    })
    if (!company) return

    // firstOrderDate rögzítése, ha még nincs.
    if (!company.firstOrderDate) {
      await prisma.company.update({
        where: { id: companyId },
        data: { firstOrderDate: new Date() },
      })
    }

    // Már partner → nincs léptetés.
    if (company.lifecycle === 'partner') return

    // Bármely más állapotból (lead-ág vagy inaktív) → partner. force=true,
    // mert a rendelés ténye felülír minden szabályt.
    const result = await transitionCompany({
      companyId,
      to: 'partner',
      source,
      actor,
      force: true,
    })

    // Új partner (első rendelés, vagy inaktívból visszatérő) → opportunity a
    // Brainbe. Csak akkor, ha tényleg most lett partnerré (nem volt az korábban).
    if (result.changed && result.from !== 'partner') {
      const name = 'name' in result.company ? (result.company as { name: string }).name : ''
      try {
        await createBrainNote({
          kind: 'opportunity',
          title: `Új partner: ${name}`,
          content: 'Első rendelés beérkezett — a cég partnerré vált.',
          status: 'captured',
          companyId,
          source: 'auto',
          importance: 3,
        })
      } catch { /* best-effort */ }
    }
  } catch {
    // Csendben elnyeljük — a rendelés fontosabb, mint a léptetés.
  }
}
