import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyEmail, threadCategory, type EmailCategory } from '@/lib/email/classify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Egyszeri (ismételhető) visszamenőleges osztályozás: a MÁR bent lévő
// leveleket besorolja (beszélgetés / automatikus / spam) a tárolt fejlécekből,
// IMAP-lekérés nélkül, majd újraszámolja a szálak kategóriáját.
// Böngészőből hívható: /api/admin/reclassify-emails
export async function GET() {
  // 1) Levelek osztályozása a rawHeaders + a 'from' résztvevő alapján.
  const emails = await prisma.email.findMany({
    take: 5000,
    select: {
      id: true, threadId: true, direction: true, category: true, rawHeaders: true,
      participants: { where: { type: 'from' }, select: { emailAddress: true }, take: 1 },
    },
  })

  const byNewCat: Record<EmailCategory, string[]> = { conversation: [], automated: [], spam: [] }
  const threadEmails = new Map<string, { direction: string; category: string }[]>()

  for (const e of emails) {
    const headers = (e.rawHeaders ?? {}) as Record<string, unknown>
    const from = e.participants[0]?.emailAddress ?? null
    const cat: EmailCategory = e.direction === 'outbound'
      ? 'conversation'
      : classifyEmail(headers, from)
    byNewCat[cat].push(e.id)
    const arr = threadEmails.get(e.threadId) ?? []
    arr.push({ direction: e.direction, category: cat })
    threadEmails.set(e.threadId, arr)
  }

  // 2) Levél-kategóriák mentése kötegelten.
  for (const [cat, ids] of Object.entries(byNewCat)) {
    if (ids.length) {
      await prisma.email.updateMany({ where: { id: { in: ids } }, data: { category: cat } })
    }
  }

  // 3) Szál-kategóriák újraszámolása és mentése kötegelten.
  const threadByCat: Record<EmailCategory, string[]> = { conversation: [], automated: [], spam: [] }
  for (const [threadId, msgs] of Array.from(threadEmails)) {
    threadByCat[threadCategory(msgs)].push(threadId)
  }
  for (const [cat, ids] of Object.entries(threadByCat)) {
    if (ids.length) {
      await prisma.emailThread.updateMany({ where: { id: { in: ids } }, data: { category: cat } })
    }
  }

  return NextResponse.json({
    ok: true,
    emails: emails.length,
    emailsByCategory: Object.fromEntries(Object.entries(byNewCat).map(([k, v]) => [k, v.length])),
    threads: threadEmails.size,
    threadsByCategory: Object.fromEntries(Object.entries(threadByCat).map(([k, v]) => [k, v.length])),
    note: emails.length >= 5000 ? 'Elérted az 5000-es kötegkorlátot — futtasd újra a maradékhoz.' : undefined,
  })
}
