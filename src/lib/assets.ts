// Kihelyezett eszközök — a prisma-függő napló. A tiszta konstansok és
// számítások a lib/assetConstants-ban vannak (onnan újraexportálva), hogy
// kliens-komponensek is használhassák prisma-behúzás nélkül.
// Teljes terv: docs/kihelyezett-eszkozok.md
//
// A jogosultsági határhoz: az emberhez kötött státusz-átmeneteket az API
// route-ok végzik (session mögött). Az /api/mcp ezeket NEM importálja — csak a
// piszkozat- és olvasó-műveleteket, így a határ szerkezeti, nem konvenció.

import { prisma } from './prisma'

export * from './assetConstants'

export type AssetAction =
  | 'created'
  | 'updated'
  | 'handover_confirmed'
  | 'contract_generated'
  | 'contract_sent'
  | 'contract_signed'
  | 'returned'
  | 'marked_lost'
  | 'discarded'

// Append-only napló (a TaskEvent mintájára). Arthur műveletei is ide kerülnek
// `actor: 'Arthur'` néven, tehát utólag mindig elkülöníthető, mit tett a gép.
export async function logAssetEvent(
  placementId: string,
  actor: string,
  action: AssetAction,
  field?: string,
  before?: unknown,
  after?: unknown,
) {
  await prisma.assetEvent.create({
    data: {
      placementId,
      actor,
      action,
      field: field ?? null,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    },
  })
}
