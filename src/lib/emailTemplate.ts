import { prisma } from '@/lib/prisma'
import {
  DEFAULT_TEMPLATE_STEPS, stepsFromTemplate, type EmailSequence, type TemplateStepDef,
} from '@/lib/emailSequence'

// ─────────────────────────────────────────────────────────────────────────
// A meleg lead email-sorozat KÖZPONTI sablonja (DB-alapú, a beállításokban
// szerkeszthető). Ha a tábla üres, a beépített alapból töltődik fel egyszer,
// hogy azonnal legyen mit szerkeszteni.
// ─────────────────────────────────────────────────────────────────────────

export async function getTemplateSteps() {
  let rows = await prisma.emailTemplateStep.findMany({ orderBy: [{ order: 'asc' }, { offsetDays: 'asc' }] })
  if (rows.length === 0) {
    await prisma.emailTemplateStep.createMany({
      data: DEFAULT_TEMPLATE_STEPS.map((t, i) => ({
        order: i, label: t.label, offsetDays: t.offsetDays,
        subject: t.subject ?? null, brief: t.brief ?? null, sampleBody: t.sampleBody ?? null,
      })),
    })
    rows = await prisma.emailTemplateStep.findMany({ orderBy: [{ order: 'asc' }, { offsetDays: 'asc' }] })
  }
  return rows
}

// A központi sablonból friss, leadhez tartozó sorozatot állít elő — a mai naptól
// számított esedékességekkel, a brief + minta + tárgy mezőkkel együtt.
export async function buildSequenceFromTemplate(from: Date = new Date()): Promise<EmailSequence> {
  const rows = await getTemplateSteps()
  const defs: TemplateStepDef[] = rows.map((r) => ({
    label: r.label, offsetDays: r.offsetDays, subject: r.subject, brief: r.brief, sampleBody: r.sampleBody,
  }))
  return stepsFromTemplate(defs, from)
}
