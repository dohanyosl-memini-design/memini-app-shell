// Havi tölcsér-tervszámok (FÁZIS 2 kiegészítés).
// Két forrás: (1) a DB FunnelTarget tábla (runtime-szerkeszthető),
// (2) az itteni beépített defaultok (verziókövetett induló feltöltés).
// A loadFunnelTargets a DB-t a defaultokra rétegzi; ha a tábla még nem
// létezik (első deploy előtt) vagy hiba történik, a defaultokat használja.

import type { prisma as defaultPrisma } from './prisma'

export interface FunnelTargetValues {
  outreach: number        // kiküldött outreach dealek
  followup: number        // follow-up aktivitások
  sampleRequests: number  // mintakérések
  newPartners: number     // új partnerek (won)
  reorders: number        // reorderek
  volumeEur: number       // rendelési volumen EUR-ban
}

// 2026 H2 induló tervszámok
// (outreach / followup / mintakérés / új partner / reorder / volumen EUR)
export const DEFAULT_FUNNEL_TARGETS: Record<string, FunnelTargetValues> = {
  '2026-07': { outreach: 10, followup: 10, sampleRequests: 1, newPartners: 0, reorders: 1, volumeEur: 4000 },
  '2026-08': { outreach: 20, followup: 25, sampleRequests: 2, newPartners: 1, reorders: 2, volumeEur: 6000 },
  '2026-09': { outreach: 25, followup: 30, sampleRequests: 3, newPartners: 1, reorders: 1, volumeEur: 6000 },
  '2026-10': { outreach: 25, followup: 35, sampleRequests: 4, newPartners: 2, reorders: 1, volumeEur: 7000 },
  '2026-11': { outreach: 25, followup: 35, sampleRequests: 4, newPartners: 2, reorders: 1, volumeEur: 6000 },
  '2026-12': { outreach: 15, followup: 30, sampleRequests: 3, newPartners: 2, reorders: 2, volumeEur: 9000 },
}

// Csak a FunnelTarget-hozzáféréshez szükséges rész — így a mockolható teszt is működik.
type TargetDb = Pick<typeof defaultPrisma, 'funnelTarget'>

/**
 * Betölti a havi tervszámokat: a beépített defaultok + a DB-ben tárolt
 * felülírások. A DB-hiba (pl. hiányzó tábla) nem tör el semmit — defaultok.
 */
export async function loadFunnelTargets(db: TargetDb): Promise<Record<string, FunnelTargetValues>> {
  const targets: Record<string, FunnelTargetValues> = { ...DEFAULT_FUNNEL_TARGETS }
  try {
    const rows = await db.funnelTarget.findMany()
    for (const r of rows) {
      targets[r.yearMonth] = {
        outreach:       r.outreach,
        followup:       r.followup,
        sampleRequests: r.sampleRequests,
        newPartners:    r.newPartners,
        reorders:       r.reorders,
        volumeEur:      r.volumeEur,
      }
    }
  } catch {
    // A FunnelTarget tábla még nem létezik (első deploy előtt) — defaultok.
  }
  return targets
}
