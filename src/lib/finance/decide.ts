import type { DuplicateClass, DuplicateMatch } from './dedupe'
import type { Issue } from './validate'

export type DocStatus = 'needs_review' | 'recorded' | 'duplicate'

export interface Decision {
  status: DocStatus
  duplicateClass: Exclude<DuplicateClass, 'distinct'> | null
  duplicateOfId: string | null
  reasons: string[]
  needsHumanDecision: boolean
}

/**
 * Tesztidőszak: MINDEN import emberi jóváhagyásra vár (docs/penzugy-terv.md). A
 * jóváhagyás a webes felületen történik, nem MCP-n — így az ügynök a saját
 * importját nem hagyhatja jóvá. Később, bizonyított megbízhatóság után ez
 * kapcsolható át az alacsony kockázatú tételekre; a döntési logika már kész rá.
 */
export const AUTO_RECORD_CLEAN = false

export function decide(
  issues: Issue[],
  matches: DuplicateMatch[],
  autoRecordClean: boolean = AUTO_RECORD_CLEAN,
): Decision {
  const top = matches[0]
  const hasError = issues.some((i) => i.severity === 'error')
  const reasons: string[] = []

  // Biztos duplikátum: nem keletkezik új pénzügyi tétel.
  if (top?.cls === 'certain') {
    return {
      status: 'duplicate', duplicateClass: 'certain', duplicateOfId: top.existingId ?? null,
      reasons: top.reasons, needsHumanDecision: false,
    }
  }

  if (top) reasons.push(...top.reasons.map((r) => `${top.cls}: ${r}`))
  if (issues.length) reasons.push(...issues.map((i) => i.message))

  // Valószínű duplikátum / azonos esemény / helyesbítés / bármilyen hiba → ember dönt.
  if (top || hasError || issues.length) {
    return {
      status: 'needs_review', duplicateClass: top?.cls ?? null, duplicateOfId: top?.existingId ?? null,
      reasons, needsHumanDecision: true,
    }
  }

  if (autoRecordClean) {
    return { status: 'recorded', duplicateClass: null, duplicateOfId: null, reasons: [], needsHumanDecision: false }
  }
  return {
    status: 'needs_review', duplicateClass: null, duplicateOfId: null,
    reasons: ['Tesztidőszak: minden import emberi jóváhagyásra vár.'], needsHumanDecision: true,
  }
}
