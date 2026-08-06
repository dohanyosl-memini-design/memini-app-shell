import { prisma } from './prisma'
import { localDay, localDayBounds } from './localDay'
import { computePendingReplies } from './pendingReplies'

/**
 * A nap TÉNYEI — kódból, determinisztikusan. Ez a réteg soha nem értelmez és
 * nem következtet: pontosan azt adja vissza, ami az adatbázisban áll.
 *
 * Az ügynök ezt kapja alapanyagként a napi naplóhoz, és csak a narratívát meg
 * az összefüggéseket teszi hozzá. Így egy kitalált rendelésszám vagy összeg
 * fogalmilag sem kerülhet a naplóba.
 *
 * A `since` paraméterrel a napközi állapotmentések csak azt dolgozzák fel, ami
 * a legutóbbi mentésük óta történt — nem futnak neki újra az egész napnak.
 *
 * Egy korlát, amit érdemes tudni: a rendszer nem vezet állapotváltozás-naplót,
 * csak `updatedAt`-et. Ezért azt látjuk, hogy egy rendelés ma módosult és most
 * milyen státuszban van — azt nem, hogy pontosan miből lépett át.
 */

export interface DailyFactsOptions {
  /** YYYY-MM-DD (helyi nap). Alapértelmezett: ma. */
  day?: string
  /** ISO időbélyeg — csak az ez utáni események. Tipikusan a napló lastSavedAt-je. */
  since?: string
}

const LIMIT = 40

export async function collectDailyFacts(o: DailyFactsOptions = {}) {
  const day = o.day ?? localDay()
  const { start, end } = localDayBounds(day)
  const since = o.since ? new Date(o.since) : null
  // A napközi mentéseknél a vizsgált ablak a vízjeltől a nap végéig tart.
  const from = since && since > start ? since : start
  const now = new Date()
  const window = { gte: from, lte: end }

  const [
    ordersNew, ordersTouched, invoicesNew, invoicesPaid, quotesNew, quotesSent,
    dealsTouched, tasksDone, tasksNew, tasksOverdue, activities,
    emailsIn, emailsOut, threadsWaiting, stockMoves, lowStock,
    purchaseOrders, companiesNew, contactsNew, memoriesFiled, brainFiled, openLoops,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: window },
      select: { id: true, number: true, status: true, total: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.order.findMany({
      where: { updatedAt: window, createdAt: { lt: from } },
      select: { id: true, number: true, status: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.invoice.findMany({
      where: { createdAt: window },
      select: { id: true, number: true, status: true, total: true, dueDate: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.invoice.findMany({
      where: { paidAt: window },
      select: { id: true, number: true, total: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.quote.findMany({
      where: { createdAt: window },
      select: { id: true, number: true, status: true, total: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.quote.findMany({
      where: { sentAt: window },
      select: { id: true, number: true, total: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.deal.findMany({
      where: { updatedAt: window },
      select: { id: true, title: true, stage: true, value: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.task.findMany({
      where: { updatedAt: window, status: 'done' },
      select: { id: true, title: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.task.findMany({
      where: { createdAt: window },
      select: { id: true, title: true, priority: true, dueDate: true },
      take: LIMIT,
    }),
    // A lejárt feladat nem "ma történt", hanem MOST fennálló állapot — ezért
    // nem az ablakra szűrünk, hanem a jelen pillanatra.
    prisma.task.findMany({
      where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lt: now } },
      select: { id: true, title: true, dueDate: true, priority: true, company: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
      take: LIMIT,
    }),
    prisma.activity.findMany({
      where: { activityDate: window },
      select: { id: true, type: true, subject: true, outcome: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.email.findMany({
      where: { sentAt: window, direction: 'inbound', category: { not: 'spam' } },
      select: {
        id: true, subject: true, snippet: true, sentAt: true,
        thread: { select: { id: true, replyStatus: true, company: { select: { id: true, name: true } } } },
      },
      orderBy: { sentAt: 'asc' },
      take: LIMIT,
    }),
    prisma.email.count({ where: { sentAt: window, direction: 'outbound', category: { not: 'spam' } } }),
    // A "válaszra vár" listát prioritásra bontjuk: a napi vezérlőlistába csak a
    // partnerhez kötött, friss szálak kellenek — a partner nélküli / elévült
    // szálak (gyakran zaj) külön számként jelennek meg, nem a fő listában.
    computePendingReplies({}, prisma),
    prisma.stockMovement.findMany({
      where: { createdAt: window },
      select: { id: true, type: true, quantity: true, product: { select: { name: true, sku: true } } },
      take: LIMIT,
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Product" WHERE active = true AND stock <= "minStock"
    `,
    prisma.purchaseOrder.findMany({
      where: { updatedAt: window },
      select: { id: true, number: true, status: true, supplier: { select: { name: true } } },
      take: LIMIT,
    }),
    prisma.company.findMany({ where: { createdAt: window }, select: { id: true, name: true, city: true }, take: LIMIT }),
    prisma.contact.findMany({
      where: { createdAt: window },
      select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } },
      take: LIMIT,
    }),
    // Amit MA már rögzítettünk a hosszú távú memóriába — hogy a záró futás ne
    // iktassa be másodszor, amit a délelőtti már beírt.
    prisma.memoryEntry.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, content: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.brainNote.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, kind: true, title: true, company: { select: { id: true, name: true } } },
      take: LIMIT,
    }),
    prisma.brainNote.findMany({
      where: { kind: 'open_loop', status: 'open' },
      select: { id: true, title: true, dueDate: true, details: true, company: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: LIMIT,
    }),
  ])

  const overdueLoops = openLoops.filter(l => l.dueDate && l.dueDate < now)

  return {
    day,
    window: { from: from.toISOString(), to: end.toISOString(), incremental: Boolean(since) },
    generatedAt: now.toISOString(),

    ertekesites: {
      ujRendelesek: ordersNew,
      modosultRendelesek: ordersTouched,
      ujAjanlatok: quotesNew,
      kikuldottAjanlatok: quotesSent,
      mozdultDealek: dealsTouched,
    },
    penzugy: {
      ujSzamlak: invoicesNew,
      befizetettSzamlak: invoicesPaid,
    },
    feladatok: {
      elvegzett: tasksDone,
      uj: tasksNew,
      lejart: tasksOverdue,
    },
    kommunikacio: {
      aktivitasok: activities,
      beerkezettLevelek: emailsIn.map(e => ({
        id: e.id,
        subject: e.subject,
        snippet: e.snippet,
        sentAt: e.sentAt,
        threadId: e.thread.id,
        replyStatus: e.thread.replyStatus,
        company: e.thread.company,
      })),
      kikuldottLevelekSzama: emailsOut,
      // Csak a partnerhez kötött, friss szálak — ez a napi vezérlőlista.
      valaszraVaroSzalak: threadsWaiting.priority,
      // A partner nélküli / elévült szálak összesítve, hogy tudni lehessen,
      // mennyi zaj van a nyers "unanswered" listában (napi listába nem kell).
      valaszraVaroEgyeb: {
        partnerNelkuliVagyElevult: threadsWaiting.counts.total - threadsWaiting.counts.priority,
        reszletek: threadsWaiting.counts,
      },
      // Üres lista nem feltétlenül azt jelenti, hogy nem jött levél — lehet,
      // hogy a CRM levélszinkronja nem fut. Ilyenkor az ügynök a saját
      // postafiók-hozzáféréséből dolgozzon.
      levelSzinkronAktiv: emailsIn.length > 0 || emailsOut > 0 || threadsWaiting.counts.total > 0,
    },
    raktar: {
      keszletmozgasok: stockMoves,
      minimumAlattiTermekek: Number(lowStock[0]?.count ?? 0),
      beszerzesiRendelesek: purchaseOrders,
    },
    ujKapcsolatok: { cegek: companiesNew, kapcsolattartok: contactsNew },

    // Mit iktattunk ma a hosszú távú memóriába, és mi van nyitva.
    tudas: {
      maRogzitettMemoriak: memoriesFiled,
      maRogzitettBrainBejegyzesek: brainFiled,
      nyitottUgyek: openLoops.map(l => ({
        id: l.id,
        title: l.title,
        dueDate: l.dueDate,
        nextAction: (l.details as { nextAction?: string })?.nextAction ?? null,
        company: l.company,
        lejart: Boolean(l.dueDate && l.dueDate < now),
      })),
      lejartNyitottUgyek: overdueLoops.length,
    },
  }
}

export type DailyFacts = Awaited<ReturnType<typeof collectDailyFacts>>
