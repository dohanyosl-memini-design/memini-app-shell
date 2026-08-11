import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMnbRate } from '@/lib/mnb'
import { DEAL_STAGE_KEYS, LEGACY_STAGE_KEYS, normalizeStage } from '@/lib/dealStages'
import { computeFunnelStats } from '@/lib/funnelStats'
import { computeReorderDue, reorderCallTaskTitle, FULFILLED_ORDER_STATUSES } from '@/lib/reorderDue'
import { buildGoalTree } from '@/lib/goalProgress'
import { GOAL_LEVELS, GOAL_METRICS } from '@/lib/goalConstants'
import { logTaskCreated, logTaskDiff, logTaskEvent } from '@/lib/taskEvents'
import { searchKnowledge, type KnowledgeScope } from '@/lib/knowledgeSearch'
import { collectDailyFacts } from '@/lib/dailyFacts'
import { computePendingReplies } from '@/lib/pendingReplies'
import { saveJournal, getJournal, listJournals, type EmailDigestItem } from '@/lib/dailyJournal'
import { localDay, isValidDay } from '@/lib/localDay'
import {
  createBrainNote, describeBrainNote, BRAIN_KINDS, BRAIN_STATUSES,
  BRAIN_KIND_LABEL, BRAIN_STATUS_LABEL, BRAIN_DEFAULT_STATUS, type BrainKind,
} from '@/lib/brain'
import {
  transitionCompany, promoteToPartnerIfNeeded, LifecycleError,
  LIFECYCLE_STATES, LIFECYCLE_LABELS, LEAD_STATES, PARTNER_STATES, LOST_STATES,
  type LifecycleState,
} from '@/lib/lifecycle'
import { parseSequence, nextStep } from '@/lib/emailSequence'
import { buildMarketingTree } from '@/lib/marketingTree'
import { ARC_LEVELS, CHANNEL_KEYS, LANGUAGES } from '@/lib/marketingConstants'
import { logPieceCreated, logPieceDiff, logPieceEvent } from '@/lib/contentEvents'
import { ingestImageFromUrl, deleteContentImage, setPrimaryImage } from '@/lib/imageProcessing'
import { parseDueInput } from '@/lib/datetime'
import { buildFocus } from '@/lib/focus'
import { convertQuoteToOrder, nextOrderNumber, nextQuoteNumber } from '@/lib/quoteToOrder'
import { markQuoteSent } from '@/lib/quoteSend'
import { priceForQuantity, checkItemsAgainstPriceList, type PriceDeviation } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// Feladat-státusz az MCP-n: a régi 'done' kulcsot a webes 'completed'-re képezzük.
const taskStatusEnum = z.enum(['pending', 'in_progress', 'waiting', 'completed', 'done', 'cancelled'])
const normalizeTaskStatus = (s: string) => (s === 'done' ? 'completed' : s)

// Deal-szakasz enum az MCP tool-okhoz: új tölcsér-kulcsok + régi aliasok
// (a régi kulcsokat a handler normalizeStage-dzsel konvertálja — visszafelé kompatibilis).
const dealStageEnum = z.enum([...DEAL_STAGE_KEYS, ...LEGACY_STAGE_KEYS] as [string, ...string[]])

// Árajánlat-státuszok — ugyanaz a szótár, mint a /quotes felületen (QUOTE_STATUS).
const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const

// Tételcserés frissítések: a megadott tételsor LECSERÉLI a meglévőt, tehát
// adatvesztéssel járhat — ezeket akkor is romboló műveletnek jelöljük, ha
// nincs "delete" a nevükben.
const DESTRUCTIVE_TOOLS = new Set(['update_order', 'update_quote'])

/**
 * MCP tool-annotációk a tool neve alapján.
 *
 * A kliens ebből tudja eldönteni, mit futtathat külön rákérdezés nélkül.
 * Enélkül minden tool egyformán gyanús neki, és mindenre engedélyt kér.
 *
 *   olvasó (list_/get_/search_/find_) — ártalmatlan, nem módosít semmit
 *   író                              — módosít, de nyomon követhető: a
 *                                      felületen látszik a bejegyzés forrása
 *                                      és ideje, és javítható
 *   romboló (delete_*, tételcsere)   — adatvesztéssel járhat, maradjon
 *                                      engedélyköteles
 */
function annotationsFor(name: string) {
  const readOnly = /^(list|get|search|find)_/.test(name)
  const destructive = /^delete_/.test(name) || DESTRUCTIVE_TOOLS.has(name)
  return {
    readOnlyHint:    readOnly,
    destructiveHint: destructive,
    idempotentHint:  readOnly,
    openWorldHint:   false,
  }
}

function buildServer() {
  const server = new McpServer({ name: 'memini-crm', version: '2.0.0' })

  // Az annotációt egy helyen fűzzük hozzá minden regisztrációhoz, hogy ne
  // kelljen több mint száz toolnál kézzel karbantartani — és ne is lehessen
  // elfelejteni egy újnál. A hívási forma változatlan marad, így a kezelők
  // típusai továbbra is a zod-sémából jönnek.
  const baseTool = server.tool.bind(server) as (...args: unknown[]) => unknown
  server.tool = ((...args: unknown[]) => {
    const [name, description, schema, cb] = args
    if (args.length === 4 && typeof name === 'string') {
      return baseTool(name, description, schema, annotationsFor(name), cb)
    }
    return baseTool(...args)
  }) as typeof server.tool

  // ─── SZÁMLÁK ─────────────────────────────────────────────────────────────

  server.tool(
    'list_invoices',
    'Számlák listázása. Szűrhető státusz és lejárt fizetés alapján.',
    {
      status: z.enum(['open', 'sent', 'paid', 'cancelled', 'storno']).optional(),
      overdue: z.boolean().optional().describe('Csak lejárt, kifizetetlen számlák'),
    },
    async ({ status, overdue }) => {
      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (overdue) {
        where.dueDate = { lt: new Date() }
        where.status = { in: ['open', 'sent'] }
      }
      const data = await prisma.invoice.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true, city: true } },
          items: true,
        },
        orderBy: { date: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_invoice',
    'Egy számla teljes adatainak lekérése.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.invoice.findUnique({
        where: { id },
        include: {
          contact: true,
          company: true,
          items: { include: { product: true } },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Számla nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_invoice',
    'Új számla létrehozása DRAFT státuszban. Az MCP csak tervezetet hozhat létre — véglegesítés (open/sent) a webes felületen történik.',
    {
      companyId:      z.string().optional(),
      contactId:      z.string().optional(),
      date:           z.string().optional().describe('YYYY-MM-DD, alapértelmezett: ma'),
      dueDate:        z.string().describe('Fizetési határidő YYYY-MM-DD'),
      deliveryInfo:   z.string().optional(),
      notes:          z.string().optional(),
      billingName:    z.string().optional(),
      billingAddress: z.string().optional(),
      billingZip:     z.string().optional(),
      billingCity:    z.string().optional(),
      billingCountry: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number(),
        vatRate:     z.number().default(19),
        productId:   z.string().optional(),
        isDiscount:  z.boolean().default(false),
      })).min(1),
    },
    async (body) => {
      const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const vatAmount = body.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
      const total = subtotal + vatAmount

      const year = new Date().getFullYear()
      const last = await prisma.invoice.findFirst({
        where: { number: { endsWith: `/${year}` }, stornoOf: null },
        orderBy: { createdAt: 'desc' },
      })
      const lastNum = last ? parseInt(last.number.split('/')[0] || '0') : 0
      const number = `${String(lastNum + 1).padStart(2, '0')}/${year}`

      const invoice = await prisma.invoice.create({
        data: {
          number,
          date:           body.date ? new Date(body.date) : new Date(),
          dueDate:        new Date(body.dueDate),
          status:         'draft',
          notes:          body.notes || null,
          deliveryInfo:   body.deliveryInfo || null,
          billingName:    body.billingName || null,
          billingAddress: body.billingAddress || null,
          billingZip:     body.billingZip || null,
          billingCity:    body.billingCity || null,
          billingCountry: body.billingCountry || null,
          contactId:      body.contactId || null,
          companyId:      body.companyId || null,
          currency:       'EUR',
          subtotal,
          vatAmount,
          total,
          items: {
            create: body.items.map(i => ({
              description: i.description,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
              vatRate:     i.vatRate,
              total:       i.isDiscount ? -Math.abs(i.unitPrice) : i.quantity * i.unitPrice * (1 + i.vatRate / 100),
              isDiscount:  i.isDiscount,
              productId:   i.productId || null,
            })),
          },
        },
        include: { contact: true, company: true, items: true },
      })
      return { content: [{ type: 'text', text: `Számla kiállítva: ${invoice.number}\n${JSON.stringify(invoice, null, 2)}` }] }
    }
  )

  server.tool(
    'update_invoice_status',
    'Számla státuszának módosítása. KORLÁT: a "paid" (fizetve) státuszt az MCP nem állíthatja be — ezt csak a webes felületen lehet rögzíteni pénzügyi biztonsági okokból.',
    {
      id:     z.string(),
      status: z.enum(['draft', 'open', 'sent', 'cancelled']).describe('Engedélyezett átmenetek: draft→open→sent, vagy cancelled. A "paid" státusz az MCP-n keresztül nem érhető el.'),
    },
    async ({ id, status }) => {
      const data = await prisma.invoice.update({ where: { id }, data: { status } })
      return { content: [{ type: 'text', text: `Státusz frissítve: ${data.number} → ${status}` }] }
    }
  )

  // ─── SZÁLLÍTÓLEVELEK ─────────────────────────────────────────────────────

  server.tool(
    'list_delivery_notes',
    'Szállítólevelek listázása.',
    { status: z.enum(['draft', 'sent', 'delivered']).optional() },
    async ({ status }) => {
      const data = await prisma.deliveryNote.findMany({
        where: status ? { status } : {},
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true, city: true } },
          items: true,
        },
        orderBy: { date: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_delivery_note',
    'Egy szállítólevél lekérése.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.deliveryNote.findUnique({
        where: { id },
        include: { contact: true, company: true, items: true },
      })
      if (!data) return { content: [{ type: 'text', text: 'Szállítólevél nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'update_delivery_note_status',
    'Szállítólevél státuszának módosítása.',
    {
      id:     z.string(),
      status: z.enum(['draft', 'sent', 'delivered']),
    },
    async ({ id, status }) => {
      const data = await prisma.deliveryNote.update({ where: { id }, data: { status } })
      return { content: [{ type: 'text', text: `Státusz frissítve: ${data.number} → ${status}` }] }
    }
  )

  // ─── KAPCSOLATOK ─────────────────────────────────────────────────────────

  server.tool(
    'list_contacts',
    'Kapcsolatok / ügyfelek listázása.',
    {
      search:  z.string().optional(),
      crmOnly: z.boolean().optional().describe('Csak CRM ügyfelek, pipeline nélkül'),
    },
    async ({ search, crmOnly }) => {
      const PIPELINE_ONLY = ['lead', 'contacted']
      const data = await prisma.contact.findMany({
        where: {
          ...(crmOnly ? { status: { notIn: PIPELINE_ONLY } } : {}),
          ...(search ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
            ],
          } : {}),
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_contact',
    'Egy kapcsolat lekérése.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.contact.findUnique({
        where: { id },
        include: {
          company: true,
          invoices: { take: 5, orderBy: { date: 'desc' } },
          memories: { include: { type: true }, orderBy: { createdAt: 'desc' } },
          brainNotes: { orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }], take: 20 },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Kapcsolat nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_contact',
    'Új kapcsolat / ügyfél létrehozása.',
    {
      firstName: z.string(),
      lastName:  z.string(),
      email:     z.string().optional(),
      phone:     z.string().optional(),
      companyId: z.string().optional(),
      status:    z.string().optional(),
      notes:     z.string().optional(),
    },
    async (body) => {
      const data = await prisma.contact.create({ data: body })
      return { content: [{ type: 'text', text: `Kapcsolat létrehozva: ${data.firstName} ${data.lastName} (${data.id})` }] }
    }
  )

  // ─── CÉGEK ───────────────────────────────────────────────────────────────

  server.tool(
    'list_companies',
    'Cégek listázása. Alapból KIHAGYJA az elvesztett (temetőbe rakott) cégeket — a temetőt külön kérd a list_cemetery tool-lal. Szűrhető életciklusra: lifecycle="partner"/"inactive"/"prospect"/"cold_lead"/"interested", vagy view="leads" (a teljes lead-ág) / "partners" (partner+inaktív).',
    {
      search:      z.string().optional(),
      country:     z.string().optional(),
      partnerType: z.string().optional(),
      lifecycle:   z.enum(LIFECYCLE_STATES).optional().describe('Pontos életciklus-szűrő'),
      view:        z.enum(['leads', 'partners', 'all']).optional().describe('leads = lead-ág, partners = partner+inaktív, all = minden az elvesztetteken kívül'),
    },
    async ({ search, country, partnerType, lifecycle, view }) => {
      // Az elvesztettek alapból ki vannak zárva; egyik szűrő sem hozza vissza őket
      // (a temető a list_cemetery-n át érhető el).
      let lifecycleWhere: Record<string, unknown>
      if (lifecycle) {
        lifecycleWhere = { lifecycle }
      } else if (view === 'leads') {
        lifecycleWhere = { lifecycle: { in: LEAD_STATES } }
      } else if (view === 'partners') {
        lifecycleWhere = { lifecycle: { in: PARTNER_STATES } }
      } else {
        lifecycleWhere = { lifecycle: { notIn: LOST_STATES } }
      }

      const data = await prisma.company.findMany({
        where: {
          ...lifecycleWhere,
          ...(search ? {
            OR: [
              { name: { contains: search } },
              { city: { contains: search } },
              { email: { contains: search } },
            ],
          } : {}),
          ...(country ? { country } : {}),
          ...(partnerType ? { partnerType } : {}),
        },
        include: { _count: { select: { contacts: true, invoices: true, orders: true } } },
        orderBy: { name: 'asc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_company',
    'Egy cég adatainak lekérése kapcsolatokkal és számlákkal.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.company.findUnique({
        where: { id },
        include: {
          contacts: true,
          invoices: { take: 5, orderBy: { date: 'desc' } },
          memories: { include: { type: true }, orderBy: { createdAt: 'desc' } },
          brainNotes: { orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }], take: 20 },
          lifecycleEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Cég nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_company',
    'Új cég létrehozása. FONTOS: új cég alapból "prospect" (prospekt) életciklusú — sose kerül a partnerek közé felvételkor. Partnerré az első rendelés tesz. Ha biztosan tudod, hogy már megkerestük, a lifecycle="cold_lead", ha már visszajelzett, "interested".',
    {
      name:           z.string(),
      address:        z.string().optional(),
      zip:            z.string().optional(),
      city:           z.string().optional(),
      country:        z.string().optional(),
      vatId:          z.string().optional(),
      email:          z.string().optional(),
      phone:          z.string().optional(),
      customerNumber: z.string().optional(),
      lifecycle:      z.enum(['prospect', 'cold_lead', 'interested']).optional()
        .describe('Kezdő életciklus. Alap: prospect. Partnerré NEM lehet itt tenni — ahhoz rendelés kell.'),
    },
    async ({ lifecycle, ...body }) => {
      const data = await prisma.company.create({
        data: { ...body, lifecycle: lifecycle || 'prospect' },
      })
      await prisma.lifecycleEvent.create({
        data: { companyId: data.id, fromState: null, toState: data.lifecycle, source: 'mcp', actor: 'Arthur' },
      })
      return { content: [{ type: 'text', text: `Cég létrehozva: ${data.name} (${data.id}) — ${LIFECYCLE_LABELS[data.lifecycle as LifecycleState] ?? data.lifecycle}` }] }
    }
  )

  server.tool(
    'update_company',
    'Cég adatainak módosítása. Csak a megadott mezők frissülnek.',
    {
      id:             z.string().describe('Cég ID'),
      name:           z.string().optional(),
      email:          z.string().optional(),
      phone:          z.string().optional(),
      address:        z.string().optional(),
      zip:            z.string().optional(),
      city:           z.string().optional(),
      country:        z.string().optional(),
      vatId:          z.string().optional(),
      website:        z.string().optional(),
      notes:          z.string().optional(),
      classification: z.string().optional().describe('Ügyfélbesorolás (A/B/C/D)'),
      channel:        z.string().optional().describe('Értékesítési csatorna'),
    },
    async ({ id, ...fields }) => {
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) upd[k] = v || null
      const data = await prisma.company.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Cég frissítve: ${data.name}` }] }
    }
  )

  // ─── ÉLETCIKLUS (lead → partner → temető) ─────────────────────────────────

  server.tool(
    'set_company_lifecycle',
    'Cég életciklus-léptetése. Állapotok: prospect (prospekt) → cold_lead (hideg lead) → interested (érdeklődő) → partner → inactive (inaktív), plusz lost_lead / lost_partner (elvesztett, = temető). Elvesztettbe (lost_*) csak KÖTELEZŐ indokkal lehet lépni — a reason-t a saját szavaiddal, konkrétan írd (mit mondott, mikor, milyen csatornán). Partnerré rendeléssel érdemes tenni (create_order), de kézzel is lehet.',
    {
      id:        z.string().describe('Cég ID'),
      lifecycle: z.enum(LIFECYCLE_STATES).describe('Célállapot'),
      reason:    z.string().optional().describe('Indok — lost_lead / lost_partner esetén KÖTELEZŐ (min. 10 karakter)'),
    },
    async ({ id, lifecycle, reason }) => {
      try {
        const result = await transitionCompany({ companyId: id, to: lifecycle, reason, source: 'mcp', actor: 'Arthur' })
        if (!result.changed) {
          return { content: [{ type: 'text', text: `A cég már ${LIFECYCLE_LABELS[lifecycle]} állapotban van — nincs teendő.` }] }
        }
        return { content: [{ type: 'text', text: `Életciklus frissítve: ${result.company.name} → ${LIFECYCLE_LABELS[lifecycle]}` }] }
      } catch (e) {
        if (e instanceof LifecycleError) return { content: [{ type: 'text', text: `Nem sikerült: ${e.message}` }], isError: true }
        throw e
      }
    }
  )

  server.tool(
    'move_company_to_cemetery',
    'Cég temetőbe helyezése (elvesztett). Kényelmi tool: magától eldönti, hogy elvesztett partner (ha valaha rendelt) vagy elvesztett lead. NEM töröl — a cég minden adata megmarad, és a restore_company_from_cemetery visszahozza. Az indok KÖTELEZŐ.',
    {
      id:     z.string().describe('Cég ID'),
      reason: z.string().describe('Miért veszett el — kötelező, min. 10 karakter (mit mondott, mikor, milyen csatornán)'),
    },
    async ({ id, reason }) => {
      const company = await prisma.company.findUnique({ where: { id }, select: { firstOrderDate: true, lifecycle: true } })
      if (!company) return { content: [{ type: 'text', text: 'Cég nem található.' }], isError: true }
      const wasPartner = !!company.firstOrderDate || company.lifecycle === 'partner' || company.lifecycle === 'inactive'
      const target: LifecycleState = wasPartner ? 'lost_partner' : 'lost_lead'
      try {
        const result = await transitionCompany({ companyId: id, to: target, reason, source: 'mcp', actor: 'Arthur' })
        return { content: [{ type: 'text', text: `Temetőbe helyezve: ${result.company.name} → ${LIFECYCLE_LABELS[target]}\nIndok: ${reason}` }] }
      } catch (e) {
        if (e instanceof LifecycleError) return { content: [{ type: 'text', text: `Nem sikerült: ${e.message}` }], isError: true }
        throw e
      }
    }
  )

  server.tool(
    'restore_company_from_cemetery',
    'Cég visszahozása a temetőből a megadott aktív állapotba (pl. egy ex-partner visszatér → partner, egy ex-lead újra megkereshető → prospect).',
    {
      id:        z.string().describe('Cég ID'),
      lifecycle: z.enum(['prospect', 'cold_lead', 'interested', 'partner', 'inactive']).describe('Cél aktív állapot'),
      note:      z.string().optional().describe('Megjegyzés a visszahozásról (a naplóba kerül)'),
    },
    async ({ id, lifecycle, note }) => {
      try {
        const result = await transitionCompany({ companyId: id, to: lifecycle, reason: note, source: 'mcp', actor: 'Arthur' })
        return { content: [{ type: 'text', text: `Visszahozva a temetőből: ${result.company.name} → ${LIFECYCLE_LABELS[lifecycle]}` }] }
      } catch (e) {
        if (e instanceof LifecycleError) return { content: [{ type: 'text', text: `Nem sikerült: ${e.message}` }], isError: true }
        throw e
      }
    }
  )

  server.tool(
    'list_cemetery',
    'Az elvesztett cégek (temető) listája indokkal és dátummal. type="lost_lead" (sosem lett partner) vagy "lost_partner" (partner volt, elment) szűrhető.',
    {
      type:   z.enum(['lost_lead', 'lost_partner']).optional(),
      search: z.string().optional(),
    },
    async ({ type, search }) => {
      const data = await prisma.company.findMany({
        where: {
          lifecycle: type ? type : { in: LOST_STATES },
          ...(search ? { OR: [{ name: { contains: search } }, { city: { contains: search } }] } : {}),
        },
        select: {
          id: true, name: true, city: true, lifecycle: true, lostReason: true, lostAt: true,
          firstOrderDate: true, _count: { select: { orders: true } },
        },
        orderBy: { lostAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_company_lifecycle_history',
    'Egy cég teljes életciklus-naplója (minden állapotváltás időrendben, legújabb elöl) — ki/mi léptette, mikor, milyen indokkal.',
    { id: z.string().describe('Cég ID') },
    async ({ id }) => {
      const events = await prisma.lifecycleEvent.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'desc' },
      })
      if (events.length === 0) return { content: [{ type: 'text', text: 'Nincs életciklus-esemény ehhez a céghez.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] }
    }
  )

  // ─── MELEG LEAD EMAIL-SOROZAT (kézi küldés, Arthur segít megírni) ──────────

  server.tool(
    'list_due_lead_emails',
    'A meleg leadek (warm_lead) kézi email-sorozatának SORON KÖVETKEZŐ, még ki nem küldött levele — kinek kell most írni. Alapból csak az esedékeseket adja (ma vagy korábban). A leveleket NEM küldi ki (a küldés kézi), csak megmutatja, mit kell megírni, kinek, milyen megszólítással és nyelven. A megírás után jelöld kimentnek: mark_lead_email_sent.',
    {
      includeUpcoming: z.boolean().optional().describe('true = a jövőben esedékes következő leveleket is add vissza (nem csak a ma/korábban esedékeseket)'),
    },
    async ({ includeUpcoming }) => {
      const today = localDay()
      const leads = await prisma.company.findMany({
        where: { lifecycle: 'warm_lead' },
        select: {
          id: true, name: true, city: true, partnerType: true, language: true, emailSequence: true,
          contacts: {
            where: { archivedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { id: true, salutation: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      const rows = leads.map((c) => {
        const seq = parseSequence(c.emailSequence)
        const next = nextStep(seq)
        if (!next) return null // minden levél kiment — nincs teendő
        const overdue = !!(next.dueAt && next.dueAt < today)
        const dueNow = !next.dueAt || next.dueAt <= today
        if (!includeUpcoming && !dueNow) return null // csak az esedékesek
        const ct = c.contacts[0] ?? null
        return {
          companyId: c.id,
          company: c.name,
          city: c.city,
          partnerType: c.partnerType,
          language: c.language, // DE / EN / HU — ezen a nyelven írj
          contact: ct
            ? { id: ct.id, salutation: ct.salutation, firstName: ct.firstName, lastName: ct.lastName, email: ct.email }
            : null,
          nextEmail: {
            stepId: next.id,
            label: next.label,
            dueAt: next.dueAt,
            overdue,
            // A meglévő piszkozat (ha van) — szerkeszd, ne írd felül vakon.
            draft: (next.subject || next.body || next.bodyHu)
              ? { subject: next.subject ?? null, body: next.body ?? null, bodyHu: next.bodyHu ?? null }
              : null,
          },
          sequence: (seq?.steps ?? []).map((s) => ({ label: s.label, dueAt: s.dueAt, sent: !!s.sentAt })),
        }
      }).filter((r): r is NonNullable<typeof r> => r !== null)

      if (rows.length === 0) {
        return { content: [{ type: 'text', text: includeUpcoming ? 'Nincs meleg lead kiküldendő levéllel.' : 'Ma nincs esedékes meleg lead levél. (includeUpcoming=true a jövőbeliekhez.)' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  server.tool(
    'mark_lead_email_sent',
    'Egy meleg lead sorozat-lépését KIMENTKÉNT jelöli (miután megírtad/elküldted a levelet). A sorozatban a következő levél lép a helyére. A stepId a list_due_lead_emails nextEmail.stepId értéke.',
    {
      companyId: z.string().describe('Cég ID'),
      stepId:    z.string().describe('A kimentnek jelölendő lépés ID-ja (nextEmail.stepId)'),
    },
    async ({ companyId, stepId }) => {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, emailSequence: true } })
      if (!company) return { content: [{ type: 'text', text: 'Cég nem található.' }], isError: true }
      const seq = parseSequence(company.emailSequence) ?? { steps: [] }
      const step = seq.steps.find((s) => s.id === stepId)
      if (!step) return { content: [{ type: 'text', text: 'A megadott lépés nem található a sorozatban.' }], isError: true }
      const updated = { steps: seq.steps.map((s) => (s.id === stepId && !s.sentAt ? { ...s, sentAt: new Date().toISOString() } : s)) }
      await prisma.company.update({
        where: { id: companyId },
        data: { emailSequence: updated as unknown as Prisma.InputJsonValue },
      })
      const upcoming = nextStep(parseSequence(updated))
      const nextTxt = upcoming ? `A következő levél: „${upcoming.label}" (esedékes: ${upcoming.dueAt ?? '—'}).` : 'Ezzel a sorozat összes levele kiment.'
      return { content: [{ type: 'text', text: `Kimentnek jelölve: „${step.label}" — ${company.name}.\n${nextTxt}` }] }
    }
  )

  server.tool(
    'set_lead_email_draft',
    'Egy meleg lead sorozat-lépéséhez piszkozatot ír/frissít: a küldendő levelet a cég nyelvén (DE/EN) ÉS a magyar kontroll-fordítást. A felhasználó a szerkesztőben átnézi, kimásolja és a saját rendszeréből küldi (a küldést NEM ez a tool végzi). A megszólítást a kontakt salutation-je (Herr/Frau) alapján válaszd, a nyelvet a cég language mezője alapján. Csak a megadott mezőket írja felül.',
    {
      companyId: z.string().describe('Cég ID'),
      stepId:    z.string().describe('A lépés ID-ja (list_due_lead_emails nextEmail.stepId)'),
      subject:   z.string().optional().describe('A levél tárgya'),
      body:      z.string().optional().describe('A küldendő levél a cég nyelvén (DE/EN)'),
      bodyHu:    z.string().optional().describe('Magyar kontroll-fordítás — ugyanaz a tartalom magyarul'),
    },
    async ({ companyId, stepId, subject, body, bodyHu }) => {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, emailSequence: true } })
      if (!company) return { content: [{ type: 'text', text: 'Cég nem található.' }], isError: true }
      const seq = parseSequence(company.emailSequence) ?? { steps: [] }
      const step = seq.steps.find((s) => s.id === stepId)
      if (!step) return { content: [{ type: 'text', text: 'A megadott lépés nem található a sorozatban.' }], isError: true }

      const updated = {
        steps: seq.steps.map((s) => s.id === stepId ? {
          ...s,
          ...(subject !== undefined ? { subject: subject || null } : {}),
          ...(body    !== undefined ? { body:    body    || null } : {}),
          ...(bodyHu  !== undefined ? { bodyHu:  bodyHu  || null } : {}),
          draftUpdatedAt: new Date().toISOString(),
        } : s),
      }
      await prisma.company.update({
        where: { id: companyId },
        data: { emailSequence: updated as unknown as Prisma.InputJsonValue },
      })
      return { content: [{ type: 'text', text: `Piszkozat mentve: „${step.label}" — ${company.name}. A felhasználó a szerkesztőben átnézi és elküldi.` }] }
    }
  )

  const dayHoursSchema = z.object({
    day:    z.number().int().min(0).max(6).describe('0=Hétfő … 6=Vasárnap'),
    open:   z.string().regex(/^\d{2}:\d{2}$/).describe('Nyitás HH:MM'),
    close:  z.string().regex(/^\d{2}:\d{2}$/).describe('Zárás HH:MM'),
    closed: z.boolean().describe('true = zárva ezen a napon'),
  })

  server.tool(
    'set_company_hours',
    'Cég nyitvatartásának beállítása. Megadható reguláris heti rend és tetszőleges számú időszakos override (pl. nyári, karácsonyi nyitvatartás).',
    {
      id: z.string().describe('Cég ID'),
      regular: z.array(dayHoursSchema).length(7)
        .describe('Heti alap-nyitvatartás, pontosan 7 elem (0=Hétfő … 6=Vasárnap)'),
      periods: z.array(z.object({
        label: z.string().describe('Időszak neve, pl. "Nyári nyitvatartás"'),
        from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Kezdő dátum YYYY-MM-DD'),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Záró dátum YYYY-MM-DD'),
        days:  z.array(dayHoursSchema).length(7)
          .describe('Az időszakra érvényes heti rend, pontosan 7 elem'),
      })).optional().describe('Időszakos override-ok (opcionális)'),
    },
    async ({ id, regular, periods }) => {
      const data = await prisma.company.update({
        where: { id },
        data: { businessHours: { regular, periods: periods ?? [] } },
        select: { name: true },
      })
      const periodCount = periods?.length ?? 0
      return { content: [{ type: 'text', text: `Nyitvatartás beállítva: ${data.name} — ${periodCount} időszakos override` }] }
    }
  )

  server.tool(
    'get_company_hours',
    'Cég nyitvatartásának lekérése, beleértve az aktív időszakos override-ot (ha van).',
    { id: z.string().describe('Cég ID') },
    async ({ id }) => {
      const data = await prisma.company.findUnique({
        where: { id },
        select: { name: true, businessHours: true },
      })
      if (!data) return { content: [{ type: 'text', text: 'Cég nem található.' }] }
      if (!data.businessHours) return { content: [{ type: 'text', text: `${data.name}: nincs nyitvatartás beállítva.` }] }

      const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
      const bh = data.businessHours as { regular: {day:number;open:string;close:string;closed:boolean}[]; periods: {label:string;from:string;until:string;days:{day:number;open:string;close:string;closed:boolean}[]}[] }

      const now = new Date()
      const activePeriod = bh.periods?.find(p => {
        if (!p.from || !p.until) return false
        const until = new Date(p.until); until.setHours(23,59,59)
        return now >= new Date(p.from) && now <= until
      })

      const fmtSchedule = (days: typeof bh.regular) =>
        days.map(d => `  ${DAYS[d.day]}: ${d.closed ? 'Zárva' : `${d.open}–${d.close}`}`).join('\n')

      let text = `${data.name} — Nyitvatartás\n\nAlap heti rend:\n${fmtSchedule(bh.regular)}`
      if (bh.periods?.length) {
        text += `\n\nIdőszakos override-ok (${bh.periods.length} db):`
        for (const p of bh.periods) {
          const active = activePeriod === p ? ' ← AKTÍV' : ''
          text += `\n\n${p.label} (${p.from} – ${p.until})${active}:\n${fmtSchedule(p.days)}`
        }
      }
      return { content: [{ type: 'text', text }] }
    }
  )

  server.tool(
    'update_contact',
    'Kapcsolat / ügyfél adatainak módosítása.',
    {
      id:        z.string().describe('Kapcsolat ID'),
      firstName: z.string().optional(),
      lastName:  z.string().optional(),
      email:     z.string().optional(),
      phone:     z.string().optional(),
      status:    z.string().optional().describe('CRM státusz (lead, contacted, customer stb.)'),
      notes:     z.string().optional(),
      companyId: z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) upd[k] = v || null
      const data = await prisma.contact.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Kapcsolat frissítve: ${data.firstName} ${data.lastName}` }] }
    }
  )

  // ─── DEAL PIPELINE ────────────────────────────────────────────────────────

  server.tool(
    'list_deals',
    'Deal pipeline listázása. Szűrhető cég, kapcsolat és szakasz szerint.',
    {
      companyId: z.string().optional(),
      contactId: z.string().optional(),
      stage:     dealStageEnum.optional().describe('Szakasz-szűrő (régi kulcsok is elfogadottak, automatikusan konvertálva)'),
    },
    async ({ companyId, contactId, stage }) => {
      const where: Record<string, unknown> = {}
      if (companyId) where.companyId = companyId
      if (contactId) where.contactId = contactId
      if (stage)     where.stage     = normalizeStage(stage)
      const data = await prisma.deal.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_deal',
    'Új deal / üzleti lehetőség létrehozása a pipeline-ban.',
    {
      title:       z.string().describe('Deal megnevezése'),
      value:       z.number().optional().describe('Becsült értéke EUR-ban'),
      stage:       dealStageEnum.optional().describe('Szakasz (régi kulcsok is elfogadottak, automatikusan konvertálva)'),
      probability: z.number().int().min(0).max(100).optional().describe('Sikervalószínűség %'),
      closeDate:   z.string().optional().describe('Várható zárás YYYY-MM-DD'),
      notes:       z.string().optional(),
      companyId:   z.string().optional(),
      contactId:   z.string().optional(),
    },
    async (body) => {
      const data = await prisma.deal.create({
        data: {
          title:       body.title,
          value:       body.value       ?? 0,
          stage:       normalizeStage(body.stage),
          probability: body.probability ?? 0,
          closeDate:   body.closeDate   ? new Date(body.closeDate) : null,
          notes:       body.notes       || null,
          companyId:   body.companyId   || null,
          contactId:   body.contactId   || null,
        },
      })
      return { content: [{ type: 'text', text: `Deal létrehozva: ${data.title} (${data.stage}) — ID: ${data.id}` }] }
    }
  )

  server.tool(
    'update_deal',
    'Deal státuszának, értékének, szakaszának módosítása.',
    {
      id:          z.string().describe('Deal ID'),
      title:       z.string().optional(),
      value:       z.number().optional(),
      stage:       dealStageEnum.optional().describe('Szakasz (régi kulcsok is elfogadottak, automatikusan konvertálva)'),
      probability: z.number().int().min(0).max(100).optional(),
      closeDate:   z.string().optional().describe('YYYY-MM-DD, vagy üres a törléshez'),
      notes:       z.string().optional(),
    },
    async ({ id, closeDate, ...fields }) => {
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) upd[k] = v
      if (typeof upd.stage === 'string') upd.stage = normalizeStage(upd.stage)
      if (closeDate !== undefined) upd.closeDate = closeDate ? new Date(closeDate) : null
      const data = await prisma.deal.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Deal frissítve: ${data.title} → ${data.stage} (${data.probability}%)` }] }
    }
  )

  server.tool(
    'get_funnel_stats',
    'B2B értékesítési tölcsér KPI-jai egyetlen lekérdezésben, havi vagy heti bontásban: kiküldött outreach dealek, follow-up aktivitások, mintakérések, új partnerek (won), reorderek száma/értéke, rendelési volumen — plusz a jelenlegi pipeline szakaszonkénti konverziója. A planVsActual szekció havi és év elejétől kumulált terv/tény/eltérés%-ot ad minden mutatóra (tervszámok: FunnelTarget tábla, hiányában beépített defaultok).',
    {
      granularity: z.enum(['month', 'week']).optional().describe('Bontás: month (alapértelmezett) vagy week'),
      periods:     z.number().int().min(1).max(24).optional().describe('Visszamenőleges időszakok száma (hónap: 6, hét: 8 alapból)'),
    },
    async ({ granularity, periods }) => {
      const stats = await computeFunnelStats({ granularity, periods })
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    }
  )

  server.tool(
    'list_reorder_due',
    'Esedékes reorder lista: won partnerek, akiknek az utolsó teljesített (kiszállított/átadott) rendelése régen (alapból 9+ hónapja) volt, legrégebbi elöl. Tartalmazza a reorder-arány KPI-t és a nov–jan szezon-előtti "szezon-hívás" jelöléseket. FONTOS: nézd meg a "reliability" mezőt — ha reliable=false, a lista won partnerek vagy teljesített rendelési előzmény híján NEM megbízható, és a "0 esedékes" adathiányt jelent, nem tényleges állapotot.',
    {
      thresholdMonths: z.number().int().min(1).max(36).optional().describe('Esedékességi küszöb hónapban (alapértelmezett: 9)'),
    },
    async ({ thresholdMonths }) => {
      const data = await computeReorderDue({ thresholdMonths })
      const warning = data.reliability.reliable ? '' : `⚠️ FIGYELEM: ${data.reliability.reason}\n\n`
      return { content: [{ type: 'text', text: `${warning}${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'schedule_reorder_call',
    'Reorder-hívás ütemezése egy partnerhez: feladatot hoz létre, amelynek címében a cégnév és az utolsó teljesített rendelés dátuma szerepel.',
    {
      companyId: z.string().describe('A partner cég ID-ja'),
      dueDate:   z.string().optional().describe('Határidő YYYY-MM-DD (alapértelmezett: nincs)'),
      priority:  z.enum(['low', 'medium', 'high']).optional().describe('Prioritás (alapértelmezett: medium)'),
    },
    async ({ companyId, dueDate, priority }) => {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } })
      if (!company) return { content: [{ type: 'text', text: 'Cég nem található.' }] }

      const lastOrder = await prisma.order.findFirst({
        where: { companyId, status: { in: FULFILLED_ORDER_STATUSES } },
        orderBy: { date: 'desc' },
        select: { date: true },
      })

      const title = reorderCallTaskTitle(company.name, lastOrder?.date ?? null)
      const task = await prisma.task.create({
        data: {
          title,
          description: 'Reorder-hívás — a partner régóta nem rendelt, egyeztetés a következő rendelésről.',
          dueDate:  dueDate ? new Date(dueDate) : null,
          priority: priority || 'medium',
          status:   'pending',
          taskType: 'call',
          source:   'automation',
          companyId,
        },
      })
      await logTaskCreated(task.id, 'automation')
      return { content: [{ type: 'text', text: `Feladat létrehozva: ${task.title} (ID: ${task.id})` }] }
    }
  )

  // ─── TERMÉKEK ─────────────────────────────────────────────────────────────

  server.tool(
    'list_products',
    'Termékek listázása raktárkészlettel.',
    {
      search:   z.string().optional(),
      material: z.string().optional().describe('Hordozó kódja'),
    },
    async ({ search, material }) => {
      const data = await prisma.product.findMany({
        where: {
          ...(search ? {
            OR: [
              { name: { contains: search } },
              { nameDE: { contains: search } },
              { sku: { contains: search } },
            ],
          } : {}),
          ...(material ? { material: { equals: material } } : {}),
        },
        orderBy: { name: 'asc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ─── HORDOZÓK ────────────────────────────────────────────────────────────

  server.tool(
    'list_carriers',
    'Hordozók listázása kódokkal és német nevekkel.',
    {},
    async () => {
      const data = await prisma.carrier.findMany({ orderBy: { sortOrder: 'asc' } })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ─── MEGRENDELÉSEK ───────────────────────────────────────────────────────

  server.tool(
    'list_orders',
    'Vevői megrendelések listázása. Lehetséges státuszok: pending, confirmed, in_production, packing (összekészítés), shipped, delivered, cancelled.',
    {
      companyId: z.string().optional(),
      contactId: z.string().optional(),
      status:    z.string().optional().describe('Szűrés státusz szerint: pending, confirmed, in_production, packing, shipped, delivered, cancelled'),
    },
    async ({ companyId, contactId, status }) => {
      const data = await prisma.order.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          ...(contactId ? { contactId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          company: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_order',
    'Egy megrendelés lekérése.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.order.findUnique({
        where: { id },
        include: { contact: true, company: true, items: { include: { product: true } } },
      })
      if (!data) return { content: [{ type: 'text', text: 'Megrendelés nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_order',
    'Új VEVŐI megrendelés (megrendelőlap) létrehozása "pending" (függőben) státuszban, automatikus sorszámozással (MR-ÉV-sorszám) — ebből számla generálható. Ez NEM a gyártópartnernek küldött beszerzési rendelés (ahhoz lásd: create_purchase_order). Pl. ha egy beérkező ügyfél-email alapján kell megrendelőlapot készíteni egy vevői rendelésről.',
    {
      companyId:       z.string().optional().describe('Cég ID'),
      contactId:       z.string().optional().describe('Kapcsolattartó ID'),
      date:            z.string().optional().describe('Rendelés dátuma YYYY-MM-DD, alapértelmezett: ma'),
      customerRef:     z.string().optional().describe('Ügyfél saját hivatkozási / rendelésszáma'),
      notes:           z.string().optional().describe('Megjegyzés (megjelenik a megrendelőlapon)'),
      internalNotes:   z.string().optional().describe('Belső megjegyzés (nem kerül a megrendelőlapra)'),
      deliveryAddress: z.string().optional(),
      deliveryDate:    z.string().optional().describe('Kívánt szállítási dátum YYYY-MM-DD'),
      shippingMethod:  z.string().optional(),
      quoteId:         z.string().optional().describe('Ha a megrendelés egy elfogadott árajánlatból származik, az árajánlat ID-ja — így a kettő össze lesz kapcsolva. Ajánlatból induláshoz inkább a convert_quote_to_order tool-t használd.'),
      items: z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number(),
        vatRate:     z.number().default(19),
        productId:   z.string().optional(),
      })).min(1).describe('Megrendelt tételek, legalább egy szükséges'),
    },
    async (body) => {
      const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const vatAmount = body.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
      const total = subtotal + vatAmount

      const order = await prisma.order.create({
        data: {
          number:          await nextOrderNumber(),
          date:            body.date ? new Date(body.date) : new Date(),
          status:          'pending',
          notes:           body.notes || null,
          internalNotes:   body.internalNotes || null,
          customerRef:     body.customerRef || null,
          deliveryAddress: body.deliveryAddress || null,
          deliveryDate:    body.deliveryDate ? new Date(body.deliveryDate) : null,
          shippingMethod:  body.shippingMethod || null,
          contactId:       body.contactId || null,
          companyId:       body.companyId || null,
          quoteId:         body.quoteId || null,
          currency:        'EUR',
          subtotal,
          vatAmount,
          total,
          items: {
            create: body.items.map(i => ({
              description: i.description,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
              vatRate:     i.vatRate,
              total:       i.quantity * i.unitPrice * (1 + i.vatRate / 100),
              productId:   i.productId || null,
            })),
          },
        },
        include: { contact: true, company: true, items: true },
      })

      // Partnerré az első rendelés tesz — ha Arthur rögzít rendelést egy
      // lead-cégre, az automatikusan átlép partnerbe (naplózva, source: mcp).
      await promoteToPartnerIfNeeded(order.companyId, 'mcp', 'Arthur')

      return { content: [{ type: 'text', text: `Megrendelés létrehozva: ${order.number}\n${JSON.stringify(order, null, 2)}` }] }
    }
  )

  server.tool(
    'update_order',
    'Meglévő megrendelés adatainak módosítása. Csak a megadott mezők frissülnek. Ha megadod az "items" tömböt, az lecseréli az összes tételt és újraszámolja az összegeket.',
    {
      id:              z.string().describe('Megrendelés ID'),
      companyId:       z.string().optional(),
      contactId:       z.string().optional(),
      date:            z.string().optional().describe('YYYY-MM-DD'),
      customerRef:     z.string().optional(),
      notes:           z.string().optional(),
      internalNotes:   z.string().optional(),
      deliveryAddress: z.string().optional(),
      deliveryDate:    z.string().optional().describe('YYYY-MM-DD'),
      shippingMethod:  z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number(),
        vatRate:     z.number().default(19),
        productId:   z.string().optional(),
      })).optional().describe('Ha megadod, lecseréli az összes meglévő tételt'),
    },
    async ({ id, items, ...fields }) => {
      const updateData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        updateData[k] = (k === 'date' || k === 'deliveryDate') ? new Date(v as string) : v
      }

      if (items && items.length > 0) {
        const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
        updateData.subtotal = subtotal
        updateData.vatAmount = vatAmount
        updateData.total = subtotal + vatAmount
        await prisma.orderItem.deleteMany({ where: { orderId: id } })
        updateData.items = {
          create: items.map(i => ({
            description: i.description,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            vatRate:     i.vatRate,
            total:       i.quantity * i.unitPrice * (1 + i.vatRate / 100),
            productId:   i.productId || null,
          })),
        }
      }

      const data = await prisma.order.update({
        where: { id },
        data: updateData,
        include: { contact: true, company: true, items: true },
      })
      return { content: [{ type: 'text', text: `Megrendelés frissítve: ${data.number}\n${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'update_order_status',
    'Vevői megrendelés státuszának módosítása. Érvényes státuszok (TELJES LISTA): pending (függőben) → confirmed (visszaigazolva) → in_production (gyártásban) → packing (összekészítés/csomagolás) → shipped (kiszállítva) → delivered (átadva). Bármikor: cancelled (lemondva). A "packing" státusz az összekészítési/csomagolási fázist jelöli.',
    {
      id:     z.string().describe('Megrendelés ID'),
      status: z.string().describe('Érvényes értékek: pending, confirmed, in_production, packing, shipped, delivered, cancelled — ahol packing = összekészítés/csomagolás a gyártás után, szállítás előtt'),
    },
    async ({ id, status }) => {
      const valid = ['pending', 'confirmed', 'in_production', 'packing', 'shipped', 'delivered', 'cancelled']
      if (!valid.includes(status)) {
        return { content: [{ type: 'text', text: `Érvénytelen státusz: "${status}". Érvényes értékek: ${valid.join(', ')}` }] }
      }
      const data = await prisma.order.update({ where: { id }, data: { status } })
      return { content: [{ type: 'text', text: `Megrendelés státusza frissítve: ${data.number} → ${status}` }] }
    }
  )

  // ─── ÁRAJÁNLATOK (Angebot) ───────────────────────────────────────────────
  //
  // Az árajánlat NEM könyvelési objektum. Ha a partner ajánlatot kér, ezeket a
  // tool-okat kell használni — soha nem szabad helyette számlatervezetet
  // (create_invoice) vagy vevői megrendelést (create_order) kiállítani.

  server.tool(
    'list_quotes',
    'Árajánlatok (Angebot) listázása. Ezzel lehet megnézni, hogy egy partnernek adtunk-e már ajánlatot és mit. Státuszok: draft (tervezet), sent (kiküldve), accepted (elfogadva), rejected (elutasítva), expired (lejárt).',
    {
      companyId: z.string().optional().describe('Szűrés cégre'),
      contactId: z.string().optional().describe('Szűrés kapcsolattartóra'),
      status:    z.enum(QUOTE_STATUSES).optional().describe('Szűrés státuszra'),
    },
    async ({ companyId, contactId, status }) => {
      const data = await prisma.quote.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          ...(contactId ? { contactId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          company: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_quote',
    'Egy árajánlat teljes adatainak lekérése azonosító alapján.',
    { id: z.string().describe('Árajánlat ID') },
    async ({ id }) => {
      const data = await prisma.quote.findUnique({
        where: { id },
        include: { contact: true, company: true, items: { include: { product: true } } },
      })
      if (!data) return { content: [{ type: 'text', text: 'Árajánlat nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_quote',
    'Új ÁRAJÁNLAT (Angebot) létrehozása "draft" (tervezet) státuszban, automatikus sorszámozással (AJ-ÉV-sorszám). Ezt kell használni, ha egy partner árajánlatot kér. Az összegeket a szerver számolja a tételekből. Az ajánlat nem könyvelési objektum: nem érinti a számlázást és a készletet. FONTOS: az egységárat előbb a get_quote_price tool-lal kérdezd le, mert az árlistában mennyiségi sávok vannak — az alapár csak a legkisebb sávra érvényes. Ha az általad megadott ár eltér a listaártól, a válasz figyelmeztetést tartalmaz (az ajánlat ettől még létrejön: az egyedi ár megengedett, csak látszódnia kell).',
    {
      companyId:  z.string().optional().describe('Cég ID'),
      contactId:  z.string().optional().describe('Kapcsolattartó ID'),
      date:       z.string().optional().describe('Ajánlat dátuma YYYY-MM-DD, alapértelmezett: ma'),
      validUntil: z.string().optional().describe('Érvényességi határidő YYYY-MM-DD (pl. 30 nap)'),
      notes:      z.string().optional().describe('Megjegyzés / feltételek (megjelenik az ajánlaton)'),
      items: z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number().describe('Nettó egységár EUR-ban'),
        vatRate:     z.number().default(19),
        productId:   z.string().optional(),
      })).min(1).describe('Ajánlott tételek, legalább egy szükséges'),
    },
    async (body) => {
      const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const vatAmount = body.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)

      const quote = await prisma.quote.create({
        data: {
          number:     await nextQuoteNumber(),
          date:       body.date ? new Date(body.date) : new Date(),
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
          status:     'draft',
          notes:      body.notes || null,
          contactId:  body.contactId || null,
          companyId:  body.companyId || null,
          currency:   'EUR',
          subtotal,
          vatAmount,
          total:      subtotal + vatAmount,
          items: {
            create: body.items.map(i => ({
              description: i.description,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
              vatRate:     i.vatRate,
              total:       i.quantity * i.unitPrice * (1 + i.vatRate / 100),
              productId:   i.productId || null,
            })),
          },
        },
        include: { contact: true, company: true, items: true },
      })

      const deviations = await checkItemsAgainstPriceList(body.items)
      const warning = deviations.length === 0 ? '' : [
        '',
        '⚠️ FIGYELEM — az alábbi tételek ára eltér az árlistától:',
        ...deviations.map((d: PriceDeviation) =>
          `  • ${d.description} (${d.quantity} db): megadva ${d.givenUnitPrice.toFixed(2)} €, ` +
          `listaár ${d.listUnitPrice.toFixed(2)} € a ${d.tierQty} darabos sávban — ` +
          `eltérés ${d.differenceEur > 0 ? '+' : ''}${d.differenceEur.toFixed(2)} € (${d.differencePercent > 0 ? '+' : ''}${d.differencePercent}%)`),
        'Az ajánlat létrejött. Ha ez nem szándékos egyedi ár, javítsd az update_quote tool-lal, és szólj Lászlónak.',
      ].join('\n')

      return { content: [{ type: 'text', text: `Árajánlat létrehozva: ${quote.number}${warning}\n${JSON.stringify(quote, null, 2)}` }] }
    }
  )

  server.tool(
    'update_quote',
    'Meglévő árajánlat módosítása. Csak a megadott mezők frissülnek. FIGYELEM: ha megadod az "items" tömböt, az LECSERÉLI az összes meglévő tételt — ezért mindig a teljes tétellistát add át, ne csak a módosítandót, különben a kimaradó tételek elvesznek. A tételek megadása nélkül a többi mező biztonságosan frissíthető.',
    {
      id:         z.string().describe('Árajánlat ID'),
      companyId:  z.string().optional(),
      contactId:  z.string().optional(),
      date:       z.string().optional().describe('YYYY-MM-DD'),
      validUntil: z.string().optional().describe('Érvényességi határidő YYYY-MM-DD'),
      notes:      z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number(),
        vatRate:     z.number().default(19),
        productId:   z.string().optional(),
      })).optional().describe('Ha megadod, lecseréli az ÖSSZES meglévő tételt — a teljes listát add át'),
    },
    async ({ id, items, ...fields }) => {
      const updateData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        updateData[k] = (k === 'date' || k === 'validUntil') ? new Date(v as string) : v
      }

      if (items && items.length > 0) {
        const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
        updateData.subtotal = subtotal
        updateData.vatAmount = vatAmount
        updateData.total = subtotal + vatAmount
        await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
        updateData.items = {
          create: items.map(i => ({
            description: i.description,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            vatRate:     i.vatRate,
            total:       i.quantity * i.unitPrice * (1 + i.vatRate / 100),
            productId:   i.productId || null,
          })),
        }
      }

      const data = await prisma.quote.update({
        where: { id },
        data: updateData,
        include: { contact: true, company: true, items: true },
      })
      return { content: [{ type: 'text', text: `Árajánlat frissítve: ${data.number}\n${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'update_quote_status',
    'Árajánlat státuszának módosítása. Érvényes státuszok (TELJES LISTA): draft (tervezet) → sent (kiküldve) → accepted (elfogadva) vagy rejected (elutasítva); expired (lejárt), ha letelt az érvényesség.',
    {
      id:     z.string().describe('Árajánlat ID'),
      status: z.enum(QUOTE_STATUSES).describe('Érvényes értékek: draft, sent, accepted, rejected, expired'),
    },
    async ({ id, status }) => {
      const data = await prisma.quote.update({ where: { id }, data: { status } })
      return { content: [{ type: 'text', text: `Árajánlat státusza frissítve: ${data.number} → ${status}` }] }
    }
  )

  server.tool(
    'convert_quote_to_order',
    'Elfogadott árajánlatból vevői megrendelés létrehozása: átveszi az ajánlat tételeit, összekapcsolja a kettőt (Order.quoteId), és az ajánlatot "accepted" státuszra állítja. A megrendelés "pending" státuszban, MR-ÉV-sorszám számmal jön létre. Csak akkor használd, ha a partner tényleg megrendelte az ajánlatot.',
    {
      quoteId:         z.string().describe('Az átalakítandó árajánlat ID-ja'),
      deliveryDate:    z.string().optional().describe('Kívánt szállítási dátum YYYY-MM-DD'),
      deliveryAddress: z.string().optional(),
      shippingMethod:  z.string().optional(),
      customerRef:     z.string().optional().describe('Ügyfél saját rendelésszáma'),
      notes:           z.string().optional().describe('Megjegyzés a megrendelőlapra; alapértelmezetten az ajánlat megjegyzése'),
    },
    async ({ quoteId, ...options }) => {
      const result = await convertQuoteToOrder(quoteId, options)

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return { content: [{ type: 'text', text: 'Árajánlat nem található.' }] }
        }
        if (result.reason === 'no_items') {
          return { content: [{ type: 'text', text: `A(z) ${result.quoteNumber} árajánlatnak nincs tétele, így nem alakítható megrendeléssé.` }] }
        }
        return {
          content: [{
            type: 'text',
            text: `A(z) ${result.quoteNumber} árajánlatból MÁR készült megrendelés: ${result.orderNumber} (ID: ${result.orderId}). Nem hoztam létre másodikat.`,
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: `Megrendelés létrehozva a(z) ${result.quoteNumber} árajánlatból: ${result.order.number} (az ajánlat státusza: accepted)\n${JSON.stringify(result.order, null, 2)}`,
        }],
      }
    }
  )

  server.tool(
    'get_quote_price',
    'Az ÉRVÉNYES nettó egységár lekérése egy hordozóból adott darabszámnál. MINDIG ezt használd árajánlat vagy megrendelés készítése előtt — az árlistában mennyiségi sávok vannak, tehát ugyanaz a termék 500 darabnál olcsóbb, mint 50-nél. Az árlista alapára (basePrice) a legkisebb sávra érvényes, nem minden mennyiségre.',
    {
      hordozo:  z.string().optional().describe('Hordozó kódja, pl. ko_aquarel_normal (lásd list_carriers / get_pricelist)'),
      search:   z.string().optional().describe('Vagy név-töredék, ha a kódot nem tudod, pl. "Aquarelle nagy"'),
      quantity: z.number().positive().describe('A rendelni kívánt darabszám'),
    },
    async ({ hordozo, search, quantity }) => {
      const entries = await prisma.priceListEntry.findMany({
        where: {
          active: true,
          ...(hordozo ? { hordozo } : {}),
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { sortOrder: 'asc' },
      })

      if (entries.length === 0) {
        return { content: [{ type: 'text', text: 'Nincs találat az árlistában. Nézd meg a get_pricelist vagy list_carriers kimenetét.' }] }
      }

      const priced = entries.map(e => {
        const p = priceForQuantity(e.basePrice, e.tiers, quantity)
        return {
          hordozo:        e.hordozo,
          name:           e.name,
          quantity,
          basePrice:      e.basePrice,
          appliedTierQty: p.tierQty,
          discountPercent: p.discountPercent,
          unitPrice:      p.unitPrice,
          lineTotalNet:   Math.round(p.unitPrice * quantity * 100) / 100,
        }
      })

      return { content: [{ type: 'text', text: JSON.stringify(priced, null, 2) }] }
    }
  )

  server.tool(
    'mark_quote_sent',
    'Az árajánlat kiküldöttre jelölése, MIUTÁN ténylegesen elment a partnernek. Státuszt "sent"-re állítja, rögzíti a kiküldés időpontját, és felvesz egy utánkövető feladatot, hogy az ajánlat ne haljon el válasz nélkül. Ne használd olyan ajánlatra, ami még nem ment ki.',
    {
      id:            z.string().describe('Árajánlat ID'),
      followUpDays:  z.number().positive().optional().describe('Hány nap múlva kérdezzünk rá (alapértelmezett: 7). Ha az ajánlat hamarabb lejár, a lejárat dátuma lesz.'),
    },
    async ({ id, followUpDays }) => {
      const result = await markQuoteSent(id, 'agent', followUpDays)

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return { content: [{ type: 'text', text: 'Árajánlat nem található.' }] }
        }
        return {
          content: [{
            type: 'text',
            text: `A(z) ${result.quoteNumber} ajánlat már ki lett küldve (${result.sentAt.toISOString().slice(0, 10)}). Nem jelöltem újra.`,
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: `A(z) ${result.quoteNumber} ajánlat kiküldöttre jelölve. Utánkövető feladat felvéve ${result.followUpAt.toISOString().slice(0, 10)} határidővel (feladat ID: ${result.taskId}).`,
        }],
      }
    }
  )

  // ─── ÁRLISTA & STATISZTIKA ───────────────────────────────────────────────

  server.tool(
    'get_pricelist',
    'Teljes árlista hordozónként, mennyiségi szintekkel.',
    {},
    async () => {
      const data = await prisma.priceListEntry.findMany({
        orderBy: { hordozo: 'asc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_stats',
    'Dashboard összesítő: bevétel, nyitott számlák, raktárkészlet.',
    {},
    async () => {
      const [openInvoices, paidThisMonth, totalProducts] = await Promise.all([
        prisma.invoice.aggregate({
          where: { status: { in: ['open', 'sent'] } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: {
            status: 'paid',
            paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
          _sum: { total: true },
          _count: true,
        }),
        prisma.product.aggregate({ _sum: { stock: true }, _count: true }),
      ])
      const stats = {
        openInvoices: { count: openInvoices._count, totalEur: openInvoices._sum.total },
        paidThisMonth: { count: paidThisMonth._count, totalEur: paidThisMonth._sum.total },
        products: { count: totalProducts._count, totalStock: totalProducts._sum.stock },
      }
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    }
  )

  // ─── TERMÉKEK (teljes írás/olvasás) ─────────────────────────────────────

  server.tool(
    'get_product',
    'Egy termék teljes adatainak lekérése ID vagy SKU alapján.',
    {
      id:  z.string().optional().describe('Termék ID'),
      sku: z.string().optional().describe('Termék SKU kód'),
    },
    async ({ id, sku }) => {
      if (!id && !sku) return { content: [{ type: 'text', text: 'Adj meg id-t vagy sku-t.' }] }
      const data = await prisma.product.findFirst({
        where: id ? { id } : { sku: sku! },
      })
      if (!data) return { content: [{ type: 'text', text: 'Termék nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_product',
    'Új termék létrehozása. A sku egyedi kód, kötelező.',
    {
      name:            z.string().describe('Magyar megnevezés'),
      sku:             z.string().describe('Egyedi cikkszám'),
      nameDE:          z.string().optional().describe('Német megnevezés'),
      description:     z.string().optional(),
      material:        z.string().optional().describe('Hordozó kód'),
      productType:     z.string().optional(),
      site:            z.string().optional(),
      city:            z.string().optional(),
      locationCabinet: z.string().optional().describe('Szekrény'),
      locationShelf:   z.string().optional().describe('Polc'),
      locationBox:     z.string().optional().describe('Doboz'),
      costPrice:       z.number().optional().describe('Bekerülési ár'),
      salesPrice:      z.number().optional().describe('Eladási ár'),
      stock:           z.number().int().optional().describe('Kezdő készlet'),
      minStock:        z.number().int().optional().describe('Minimum készlet, alapértelmezett: 10'),
      unit:            z.string().optional().describe('Mértékegység, alapértelmezett: db'),
      vatRate:         z.number().optional().describe('ÁFA kulcs %, alapértelmezett: 19'),
    },
    async (body) => {
      const data = await prisma.product.create({
        data: {
          name:            body.name,
          sku:             body.sku,
          nameDE:          body.nameDE || null,
          description:     body.description || null,
          material:        body.material || null,
          productType:     body.productType || null,
          site:            body.site || null,
          city:            body.city || null,
          locationCabinet: body.locationCabinet || null,
          locationShelf:   body.locationShelf || null,
          locationBox:     body.locationBox || null,
          costPrice:       body.costPrice ?? 0,
          salesPrice:      body.salesPrice ?? 0,
          stock:           body.stock ?? 0,
          minStock:        body.minStock ?? 10,
          unit:            body.unit || 'db',
          vatRate:         body.vatRate ?? 19,
        },
      })
      return { content: [{ type: 'text', text: `Termék létrehozva: ${data.name} (${data.sku}) — ID: ${data.id}` }] }
    }
  )

  server.tool(
    'update_product',
    'Meglévő termék adatainak módosítása. Csak a megadott mezők frissülnek.',
    {
      id:              z.string().describe('Termék ID'),
      name:            z.string().optional(),
      nameDE:          z.string().optional(),
      sku:             z.string().optional(),
      description:     z.string().optional(),
      material:        z.string().optional(),
      productType:     z.string().optional(),
      site:            z.string().optional(),
      city:            z.string().optional(),
      locationCabinet: z.string().optional(),
      locationShelf:   z.string().optional(),
      locationBox:     z.string().optional(),
      costPrice:       z.number().optional(),
      salesPrice:      z.number().optional(),
      minStock:        z.number().int().optional(),
      unit:            z.string().optional(),
      vatRate:         z.number().optional(),
      active:          z.boolean().optional().describe('false = archivált'),
    },
    async ({ id, ...fields }) => {
      const updateData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updateData[k] = v
      }
      const data = await prisma.product.update({ where: { id }, data: updateData })
      return { content: [{ type: 'text', text: `Termék frissítve: ${data.name} (${data.sku})` }] }
    }
  )

  server.tool(
    'adjust_stock',
    'Raktárkészlet mozgás rögzítése (bevét vagy kiadás).',
    {
      productId: z.string().describe('Termék ID'),
      type:      z.enum(['in', 'out']).describe('in = bevét, out = kiadás'),
      quantity:  z.number().int().positive().describe('Mennyiség (pozitív egész)'),
      note:      z.string().optional().describe('Megjegyzés'),
      supplier:  z.string().optional().describe('Szállító neve (bevétnél)'),
      reference: z.string().optional().describe('Hivatkozási szám'),
    },
    async ({ productId, type, quantity, note, supplier, reference }) => {
      const [movement, product] = await prisma.$transaction([
        prisma.stockMovement.create({
          data: { productId, type, quantity, note: note || null, supplier: supplier || null, reference: reference || null },
        }),
        prisma.product.update({
          where: { id: productId },
          data: { stock: { [type === 'in' ? 'increment' : 'decrement']: quantity } },
        }),
      ])
      return { content: [{ type: 'text', text: `Készletmozgás rögzítve: ${type === 'in' ? '+' : '-'}${quantity} db — Új készlet: ${product.stock} db` }] }
    }
  )

  server.tool(
    'list_tasks',
    'Feladatok listázása. Szűrhető státusz, prioritás, kapcsolat, cég, cél és határidő-tartomány alapján. A "waiting" státuszú feladatoknál a waitingFor mutatja, kire várunk, a followUpAt a következő ellenőrzés dátumát.',
    {
      status:    taskStatusEnum.optional(),
      priority:  z.enum(['low', 'medium', 'high']).optional(),
      contactId: z.string().optional(),
      companyId: z.string().optional(),
      goalId:    z.string().optional().describe('Csak az adott célhoz kötött feladatok'),
      dueBefore: z.string().optional().describe('Határidő eddig, YYYY-MM-DD (pl. "mi esedékes a héten?")'),
      dueAfter:  z.string().optional().describe('Határidő ettől, YYYY-MM-DD'),
    },
    async ({ status, priority, contactId, companyId, goalId, dueBefore, dueAfter }) => {
      // Az archivált (feladat-temetőbe rakott) feladatok nem jönnek elő.
      const where: Record<string, unknown> = { archivedAt: null }
      if (status) where.status = normalizeTaskStatus(status)
      if (priority) where.priority = priority
      if (contactId) where.contactId = contactId
      if (companyId) where.companyId = companyId
      if (goalId) where.goalId = goalId
      if (dueBefore || dueAfter) {
        where.dueDate = {
          ...(dueAfter ? { gte: new Date(dueAfter) } : {}),
          ...(dueBefore ? { lte: new Date(`${dueBefore}T23:59:59`) } : {}),
        }
      }
      const data = await prisma.task.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          goal: { select: { id: true, title: true, level: true } },
          subtasks: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_task',
    'Egy feladat teljes részleteinek lekérése, alfeladatokkal, cél-kapcsolattal és a legutóbbi eseménytörténettel.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.task.findUnique({
        where: { id },
        include: {
          contact: true,
          company: true,
          deal: true,
          assignee: { select: { id: true, name: true } },
          goal: { select: { id: true, title: true, level: true, year: true, quarter: true, month: true } },
          subtasks: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'desc' }, take: 15 },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Feladat nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_task',
    'Új feladat létrehozása. A dueDate YYYY-MM-DD formátumban adható meg. Célhoz kötéshez add meg a goalId-t (célok: get_goal_tree). "waiting" státusznál a waitingFor és followUpAt kötelező. A feladat "agent" forrásjelöléssel jön létre és naplózódik.',
    {
      title:       z.string(),
      description: z.string().optional(),
      dueDate:     z.string().optional().describe('Határidő. Csak nap: YYYY-MM-DD. Pontos időpont: YYYY-MM-DDTHH:mm (pl. 2026-07-25T14:30) — az idő magyar/német (Europe/Budapest) helyi idő szerint értendő.'),
      priority:    z.enum(['low', 'medium', 'high']).optional(),
      status:      taskStatusEnum.optional(),
      taskType:    z.enum(['gyartas', 'email', 'minta', 'csomagolas', 'hivas', 'admin', 'szallitas', 'megbeszeles', 'szamlairas', 'egyeb']).optional().describe('Feladat típusa'),
      goalId:      z.string().optional().describe('Cél ID, amihez a feladat tartozik'),
      assigneeId:  z.string().optional().describe('Felelős user ID'),
      waitingFor:  z.string().optional().describe('waiting státusznál: kire/mire várunk'),
      followUpAt:  z.string().optional().describe('waiting státusznál: mikor nézzük újra. YYYY-MM-DD vagy YYYY-MM-DDTHH:mm (Europe/Budapest).'),
      contactId:   z.string().optional(),
      companyId:   z.string().optional(),
      dealId:      z.string().optional(),
      subtasks:    z.array(z.string()).optional().describe('Részfeladatok listája (szövegek tömbje)'),
    },
    async (body) => {
      const status = normalizeTaskStatus(body.status || 'pending')
      if (status === 'waiting' && (!body.waitingFor || !body.followUpAt)) {
        return { content: [{ type: 'text', text: 'A "waiting" státuszhoz kötelező a waitingFor (kire várunk) és a followUpAt (mikor nézzük újra, YYYY-MM-DD).' }] }
      }
      if (body.goalId) {
        const goal = await prisma.goal.findUnique({ where: { id: body.goalId }, select: { id: true } })
        if (!goal) return { content: [{ type: 'text', text: `Nincs ilyen cél: ${body.goalId} — a célok a get_goal_tree tool-lal kérdezhetők le.` }] }
      }
      const data = await prisma.task.create({
        data: {
          title:       body.title,
          description: body.description || null,
          dueDate:     parseDueInput(body.dueDate),
          priority:    body.priority || 'medium',
          status,
          taskType:    body.taskType || null,
          source:      'agent',
          goalId:      body.goalId || null,
          assigneeId:  body.assigneeId || null,
          waitingFor:  status === 'waiting' ? body.waitingFor : null,
          followUpAt:  status === 'waiting' ? parseDueInput(body.followUpAt) : null,
          contactId:   body.contactId || null,
          companyId:   body.companyId || null,
          dealId:      body.dealId || null,
          subtasks:    body.subtasks?.length
            ? { create: body.subtasks.map(s => ({ title: s })) }
            : undefined,
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          goal: { select: { id: true, title: true } },
          subtasks: true,
        },
      })
      await logTaskCreated(data.id, 'agent')
      return { content: [{ type: 'text', text: `Feladat létrehozva: ${data.title} (${data.id})${data.goal ? ` — cél: ${data.goal.title}` : ''}` }] }
    }
  )

  server.tool(
    'update_task',
    'Feladat módosítása: státusz, prioritás, határidő, leírás, típus, felelős, cél-kapcsolat, várakozás-mezők, Fókusz-kiemelés. Csak a megadott mezők frissülnek; minden változás naplózódik a feladat eseménytörténetébe. "waiting" státuszra váltásnál a waitingFor és followUpAt kötelező.',
    {
      id:          z.string(),
      status:      taskStatusEnum.optional(),
      priority:    z.enum(['low', 'medium', 'high']).optional(),
      title:       z.string().optional(),
      description: z.string().optional(),
      dueDate:     z.string().optional().describe('Új határidő. Csak nap: YYYY-MM-DD. Pontos időpont: YYYY-MM-DDTHH:mm (Europe/Budapest helyi idő). Üres string a törléshez.'),
      taskType:    z.enum(['gyartas', 'email', 'minta', 'csomagolas', 'hivas', 'admin', 'szallitas', 'megbeszeles', 'szamlairas', 'egyeb']).optional(),
      goalId:      z.string().optional().describe('Új cél ID, vagy üres string a cél-kapcsolat törléséhez'),
      assigneeId:  z.string().optional().describe('Felelős user ID, vagy üres string a törléshez'),
      focused:     z.boolean().optional().describe('Fókuszba emelés (a Fókusz nézet tetején jelenik meg, dátumtól függetlenül)'),
      waitingFor:  z.string().optional().describe('waiting státusznál: kire/mire várunk'),
      followUpAt:  z.string().optional().describe('waiting státusznál: mikor nézzük újra. YYYY-MM-DD vagy YYYY-MM-DDTHH:mm (Europe/Budapest).'),
    },
    async ({ id, status, priority, title, description, dueDate, taskType, goalId, assigneeId, focused, waitingFor, followUpAt }) => {
      const before = await prisma.task.findUnique({ where: { id } })
      if (!before) return { content: [{ type: 'text', text: 'Feladat nem található.' }] }

      const newStatus = status ? normalizeTaskStatus(status) : before.status
      if (newStatus === 'waiting') {
        const effWaitingFor = waitingFor ?? before.waitingFor
        const effFollowUpAt = followUpAt ?? before.followUpAt
        if (!effWaitingFor || !effFollowUpAt) {
          return { content: [{ type: 'text', text: 'A "waiting" státuszhoz kötelező a waitingFor (kire várunk) és a followUpAt (mikor nézzük újra, YYYY-MM-DD).' }] }
        }
      }
      if (goalId) {
        const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { id: true } })
        if (!goal) return { content: [{ type: 'text', text: `Nincs ilyen cél: ${goalId} — a célok a get_goal_tree tool-lal kérdezhetők le.` }] }
      }

      const data = await prisma.task.update({
        where: { id },
        data: {
          ...(status      ? { status: newStatus } : {}),
          ...(priority    ? { priority }    : {}),
          ...(title       ? { title }       : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueDate !== undefined ? { dueDate: parseDueInput(dueDate) } : {}),
          ...(taskType    ? { taskType }    : {}),
          ...(goalId !== undefined ? { goalId: goalId || null } : {}),
          ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
          ...(focused !== undefined ? { focused } : {}),
          ...(newStatus === 'waiting'
            ? {
                ...(waitingFor !== undefined ? { waitingFor } : {}),
                ...(followUpAt !== undefined ? { followUpAt: parseDueInput(followUpAt) } : {}),
              }
            : status
              ? { waitingFor: null, followUpAt: null }
              : {}),
        },
      })
      await logTaskDiff(id, 'agent', before, data)
      return { content: [{ type: 'text', text: `Feladat frissítve: ${data.title} → ${data.status}` }] }
    }
  )

  server.tool(
    'archive_task',
    'Feladat archiválása (cancelled státusz). Az MCP-n keresztül nincs végleges törlés — azt csak a webes felületen lehet. Az archiválás naplózódik.',
    {
      id:     z.string().describe('Feladat ID'),
      reason: z.string().optional().describe('Az archiválás indoka (a naplóba kerül)'),
    },
    async ({ id, reason }) => {
      const before = await prisma.task.findUnique({ where: { id }, select: { title: true, status: true } })
      if (!before) return { content: [{ type: 'text', text: 'Feladat nem található.' }] }
      const data = await prisma.task.update({ where: { id }, data: { status: 'cancelled' } })
      await logTaskEvent(id, 'agent', 'archived', 'status', before.status, reason ? `cancelled (${reason})` : 'cancelled')
      return { content: [{ type: 'text', text: `Feladat archiválva: ${data.title}` }] }
    }
  )

  // ─── ALFELADATOK ─────────────────────────────────────────────────────────────

  server.tool(
    'add_subtask',
    'Alfeladat hozzáadása egy meglévő feladathoz.',
    {
      taskId:  z.string().describe('Feladat ID'),
      title:   z.string().describe('Alfeladat szövege'),
      dueDate: z.string().optional().describe('Előkészítési határidő (opcionális). YYYY-MM-DD vagy YYYY-MM-DDTHH:mm (Europe/Budapest). Ha van, az alfeladat önállóan megjelenik a Fókuszban a saját napján.'),
    },
    async ({ taskId, title, dueDate }) => {
      const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } })
      if (!task) return { content: [{ type: 'text', text: 'Feladat nem található.' }] }
      const sub = await prisma.subTask.create({ data: { taskId, title, dueDate: parseDueInput(dueDate) } })
      return { content: [{ type: 'text', text: `Alfeladat hozzáadva a(z) „${task.title}" feladathoz: ${sub.title} (${sub.id})${sub.dueDate ? ` — határidő: ${sub.dueDate.toISOString().slice(0, 10)}` : ''}` }] }
    }
  )

  server.tool(
    'update_subtask',
    'Alfeladat módosítása: kész-állapot, cím, előkészítési határidő. Csak a megadott mezők frissülnek.',
    {
      id:        z.string().describe('Alfeladat ID'),
      completed: z.boolean().optional(),
      title:     z.string().optional(),
      dueDate:   z.string().optional().describe('YYYY-MM-DD vagy YYYY-MM-DDTHH:mm (Europe/Budapest), vagy üres string a törléshez'),
    },
    async ({ id, completed, title, dueDate }) => {
      const data: Record<string, unknown> = {}
      if (completed !== undefined) data.completed = completed
      if (title !== undefined) data.title = title
      if (dueDate !== undefined) data.dueDate = dueDate ? parseDueInput(dueDate) : null
      const sub = await prisma.subTask.update({ where: { id }, data })
      return { content: [{ type: 'text', text: `Alfeladat frissítve: ${sub.title}` }] }
    }
  )

  server.tool(
    'toggle_subtask',
    'Alfeladat kész / nem kész állapotának állítása.',
    {
      id:        z.string().describe('Alfeladat ID'),
      completed: z.boolean().describe('true = kész, false = nincs kész'),
    },
    async ({ id, completed }) => {
      const sub = await prisma.subTask.update({ where: { id }, data: { completed } })
      return { content: [{ type: 'text', text: `Alfeladat ${completed ? 'késznek jelölve' : 'visszanyitva'}: ${sub.title}` }] }
    }
  )

  server.tool(
    'delete_subtask',
    'Alfeladat törlése.',
    { id: z.string().describe('Alfeladat ID') },
    async ({ id }) => {
      const sub = await prisma.subTask.findUnique({ where: { id }, select: { title: true } })
      if (!sub) return { content: [{ type: 'text', text: 'Alfeladat nem található.' }] }
      await prisma.subTask.delete({ where: { id } })
      return { content: [{ type: 'text', text: `Alfeladat törölve: ${sub.title}` }] }
    }
  )

  // ─── CÉLOK (V2) ──────────────────────────────────────────────────────────────

  server.tool(
    'get_goal_tree',
    'A teljes célhierarchia egy hívásban, kiszámolt haladással: hosszú távú (vision) → éves → negyedéves → havi célok, mindegyiknél a haladás %-a és forrása (metric = automatikus CRM-adatokból, children = al-célok átlaga, tasks = feladatok kész-aránya, manual = kézi státusz), plusz a hozzákötött feladatok száma. MINDIG ezzel kezdd, mielőtt célt vagy célhoz kötött feladatot kezelsz — ez adja a stratégiai kontextust.',
    {
      includeArchived: z.boolean().optional().describe('Archivált célok is (alapértelmezett: nem)'),
    },
    async ({ includeArchived }) => {
      const tree = await buildGoalTree({ includeArchived })
      if (tree.length === 0) {
        return { content: [{ type: 'text', text: 'Még nincs cél felvéve. A create_goal tool-lal hozható létre — kezdd a vision szinttel.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] }
    }
  )

  server.tool(
    'create_goal',
    `Új cél létrehozása a hierarchiában. Szintek: vision (hosszú távú, nincs éve) → yearly (year kötelező) → quarterly (year + quarter) → monthly (year + month). A parentId-vel kösd a szülő célhoz. Számszerű célnál adj meg metricKey-t és targetValue-t — a tény automatikusan a CRM-adatokból számítódik. Elérhető metrikák: ${GOAL_METRICS.map(m => `${m.key} (${m.label})`).join(', ')}.`,
    {
      title:         z.string().describe('Cél megnevezése'),
      level:         z.enum(GOAL_LEVELS as unknown as [string, ...string[]]).describe('vision | yearly | quarterly | monthly'),
      description:   z.string().optional().describe('Mit jelent pontosan, mikor tekintjük teljesültnek?'),
      year:          z.number().int().min(2020).max(2040).optional().describe('Év (vision kivételével kötelező)'),
      quarter:       z.number().int().min(1).max(4).optional().describe('Negyedév, quarterly szinten kötelező'),
      month:         z.number().int().min(1).max(12).optional().describe('Hónap, monthly szinten kötelező'),
      parentId:      z.string().optional().describe('Szülő cél ID'),
      strategicArea: z.string().optional().describe('Stratégiai terület címke'),
      metricKey:     z.string().optional().describe('CRM-metrika kulcs az automatikus haladáshoz'),
      targetValue:   z.number().optional().describe('Számszerű célérték a metricKey-hez'),
    },
    async (body) => {
      if (body.level !== 'vision' && !body.year) {
        return { content: [{ type: 'text', text: 'Az év megadása kötelező ezen a szinten.' }] }
      }
      if (body.level === 'quarterly' && !body.quarter) {
        return { content: [{ type: 'text', text: 'Negyedéves célhoz a quarter (1-4) kötelező.' }] }
      }
      if (body.level === 'monthly' && !body.month) {
        return { content: [{ type: 'text', text: 'Havi célhoz a month (1-12) kötelező.' }] }
      }
      if (body.metricKey && !GOAL_METRICS.some(m => m.key === body.metricKey)) {
        return { content: [{ type: 'text', text: `Ismeretlen metrika: "${body.metricKey}". Elérhető: ${GOAL_METRICS.map(m => m.key).join(', ')}` }] }
      }
      if (body.parentId) {
        const parent = await prisma.goal.findUnique({ where: { id: body.parentId }, select: { id: true, level: true } })
        if (!parent) return { content: [{ type: 'text', text: `Nincs ilyen szülő cél: ${body.parentId}` }] }
      }
      const goal = await prisma.goal.create({
        data: {
          title:         body.title,
          description:   body.description || null,
          level:         body.level,
          year:          body.level === 'vision' ? null : body.year,
          quarter:       body.level === 'quarterly' ? body.quarter : null,
          month:         body.level === 'monthly' ? body.month : null,
          strategicArea: body.strategicArea || null,
          metricKey:     body.metricKey || null,
          targetValue:   body.targetValue ?? null,
          parentId:      body.parentId || null,
        },
      })
      return { content: [{ type: 'text', text: `Cél létrehozva (${goal.level}): ${goal.title} — ID: ${goal.id}` }] }
    }
  )

  server.tool(
    'update_goal',
    'Cél módosítása: cím, leírás, státusz (active/achieved/missed/dropped), célérték, metrika, stratégiai terület, szülő. Csak a megadott mezők frissülnek. A szint (level) nem módosítható.',
    {
      id:            z.string().describe('Cél ID'),
      title:         z.string().optional(),
      description:   z.string().optional(),
      status:        z.enum(['active', 'achieved', 'missed', 'dropped']).optional(),
      strategicArea: z.string().optional(),
      metricKey:     z.string().optional().describe('Új metrika kulcs, vagy üres string a leválasztáshoz'),
      targetValue:   z.number().optional(),
      parentId:      z.string().optional().describe('Új szülő cél ID, vagy üres string a leválasztáshoz'),
      year:          z.number().int().optional(),
      quarter:       z.number().int().min(1).max(4).optional(),
      month:         z.number().int().min(1).max(12).optional(),
    },
    async ({ id, ...fields }) => {
      const goal = await prisma.goal.findUnique({ where: { id }, select: { id: true, level: true } })
      if (!goal) return { content: [{ type: 'text', text: 'Cél nem található.' }] }
      if (fields.metricKey && !GOAL_METRICS.some(m => m.key === fields.metricKey)) {
        return { content: [{ type: 'text', text: `Ismeretlen metrika: "${fields.metricKey}". Elérhető: ${GOAL_METRICS.map(m => m.key).join(', ')}` }] }
      }
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        upd[k] = (k === 'metricKey' || k === 'parentId' || k === 'strategicArea' || k === 'description') ? (v || null) : v
      }
      const data = await prisma.goal.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Cél frissítve: ${data.title} (${data.status})` }] }
    }
  )

  server.tool(
    'archive_goal',
    'Cél archiválása — eltűnik a fából, de nem törlődik, a feladat-kapcsolatok megmaradnak. KORLÁT: vision és yearly szintű célt az MCP nem archiválhat és nem törölhet — a stratégia gerincét csak a webes felületen lehet módosítani. Végleges törlés az MCP-n keresztül egyáltalán nincs.',
    {
      id:     z.string().describe('Cél ID'),
      reason: z.string().optional().describe('Az archiválás indoka'),
    },
    async ({ id, reason }) => {
      const goal = await prisma.goal.findUnique({
        where: { id },
        select: { id: true, title: true, level: true, children: { where: { archivedAt: null }, select: { id: true } } },
      })
      if (!goal) return { content: [{ type: 'text', text: 'Cél nem található.' }] }
      if (goal.level === 'vision' || goal.level === 'yearly') {
        return { content: [{ type: 'text', text: `A(z) ${goal.level} szintű cél („${goal.title}") archiválása az MCP-n keresztül nem engedélyezett — ezt csak a webes felületen (Iránytű) lehet megtenni.` }] }
      }
      if (goal.children.length > 0) {
        return { content: [{ type: 'text', text: `A célnak ${goal.children.length} aktív al-célja van — előbb azokat kell archiválni vagy áthelyezni.` }] }
      }
      await prisma.goal.update({ where: { id }, data: { archivedAt: new Date() } })
      return { content: [{ type: 'text', text: `Cél archiválva: ${goal.title}${reason ? ` — indok: ${reason}` : ''}` }] }
    }
  )

  // ─── NAPI FOCUS & RIPORT (V2) ────────────────────────────────────────────────

  server.tool(
    'get_daily_focus',
    'Egységes Fókusz-nézet egy hívásban: a következő N nap (alap: 3) MINDEN időzített tennivalója, típustól függetlenül — feladatok (deal/lead/cég kontextussal), időzített alfeladatok (előkészítő lépések a szülő feladatukkal), ütemezett marketing-posztok, lejáró utánkövetések. Napi bontásban (bucket: overdue/today/day1/day2), a kézzel kiemelt (focused) tételekkel. Ez a felhasználó napi vezérlőnézete — a feladatok/posztok időzítésével és a focused kapcsolóval alakítható.',
    {
      days: z.number().int().min(1).max(14).optional().describe('Ablak napokban (alapértelmezett: 3 = ma + 2 nap)'),
    },
    async ({ days }) => {
      const result = await buildFocus({ days: days ?? 3 })
      if (result.items.length === 0) {
        return { content: [{ type: 'text', text: 'A megadott időablakra nincs időzített tennivaló. Adj határidőt feladatoknak/alfeladatoknak, ütemezz posztot, vagy emelj ki (focused) tételt.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_progress_report',
    'Heti / időszaki előrehaladási riport: az aktuális negyedév és hónap céljai haladással, a teljes célfa csúcs-szintű összefoglalója, valamint feladat-statisztika (elmúlt 7 nap: elkészült/létrejött; nyitott, lejárt, várakozó darabszámok). A terv/tény tölcsér-részletekhez lásd: get_funnel_stats.',
    {},
    async () => {
      const now = new Date()
      const y = now.getFullYear()
      const q = Math.floor(now.getMonth() / 3) + 1
      const m = now.getMonth() + 1
      const weekAgo = new Date(now.getTime() - 7 * 86400000)

      const [tree, completedLast7, createdLast7, openCounts, overdueCount] = await Promise.all([
        buildGoalTree(),
        prisma.task.count({ where: { status: 'completed', updatedAt: { gte: weekAgo } } }),
        prisma.task.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.task.groupBy({ by: ['status'], _count: true, where: { status: { notIn: ['completed', 'cancelled'] } } }),
        prisma.task.count({ where: { status: { notIn: ['completed', 'cancelled'] }, dueDate: { lt: new Date(y, now.getMonth(), now.getDate()) } } }),
      ])

      type Node = (typeof tree)[number]
      const flat: Node[] = []
      const walk = (nodes: Node[]) => { for (const n of nodes) { flat.push(n); walk(n.children) } }
      walk(tree)

      const summarize = (n: Node) => ({
        id: n.id, title: n.title, level: n.level, status: n.status,
        percent: n.progress.percent, progressSource: n.progress.source,
        actual: n.progress.actualValue, target: n.targetValue, metricKey: n.metricKey,
        taskCount: n.taskCount, completedTaskCount: n.completedTaskCount,
      })

      const result = {
        generatedAt: now.toISOString(),
        currentQuarterGoals: flat.filter(n => n.level === 'quarterly' && n.year === y && n.quarter === q).map(summarize),
        currentMonthGoals: flat.filter(n => n.level === 'monthly' && n.year === y && n.month === m).map(summarize),
        topLevel: tree.map(summarize),
        taskStats: {
          completedLast7Days: completedLast7,
          createdLast7Days: createdLast7,
          openByStatus: Object.fromEntries(openCounts.map(c => [c.status, c._count])),
          overdue: overdueCount,
        },
        note: 'A percent a kiszámolt haladás (metric = CRM-adatokból automatikus). Részletes terv/tény: get_funnel_stats.',
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ─── KIADÁSOK ────────────────────────────────────────────────────────────

  server.tool(
    'list_expenses',
    'Kiadások listázása. Szűrhető hónap (YYYY-MM) és kategória szerint.',
    {
      month:    z.string().optional().describe('Hónap YYYY-MM formátumban, pl. 2026-05'),
      category: z.string().optional().describe('Kategória neve, pl. Marketing'),
      status:   z.enum(['pending', 'verified']).optional(),
      limit:    z.number().int().positive().max(200).optional().describe('Max találat, alapértelmezett 100'),
    },
    async ({ month, category, status, limit }) => {
      const where: Record<string, unknown> = {}
      if (month) {
        const start = new Date(`${month}-01`)
        const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1)
        where.date  = { gte: start, lt: end }
      }
      if (category) where.category = category
      if (status)   where.status   = status
      const data = await prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit ?? 100,
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_mnb_rate',
    'MNB EUR/HUF középárfolyam lekérése adott dátumra. Hétvégén/ünnepnapon automatikusan az előző munkanapra esik vissza (max 7 nap). HUF kiadások EUR-ra váltásához szükséges.',
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Dátum YYYY-MM-DD formátumban — általában a számla kelte'),
    },
    async ({ date }) => {
      const result = await getMnbRate(date)
      if (!result) {
        return { content: [{ type: 'text', text: `MNB árfolyam nem elérhető a(z) ${date} dátumra (7 napos visszakeresés is sikertelen).` }] }
      }
      const eurAmount_example = Math.round((100000 / result.rate) * 100) / 100
      return {
        content: [{
          type: 'text',
          text: `EUR/HUF árfolyam: ${result.rate} (${result.date})\nKéplet: eurAmount = totalAmount / ${result.rate}\nPélda: 100 000 HUF = ${eurAmount_example} EUR`,
        }],
      }
    }
  )

  server.tool(
    'update_expense',
    'Kiadás módosítása — kategória, státusz, leírás és pénzügyi adatok frissítéséhez. Csak az átadott mezők frissülnek (partial update).',
    {
      id:          z.string().describe('Kiadás ID'),
      category:    z.string().optional().describe('Kategória neve'),
      status:      z.enum(['pending', 'verified']).optional(),
      notes:       z.string().optional(),
      vendor:      z.string().optional(),
      description: z.string().optional(),
      amount:      z.number().optional().describe('Nettó összeg'),
      vatAmount:   z.number().optional().describe('ÁFA összeg'),
      totalAmount: z.number().optional().describe('Bruttó összeg'),
      currency:    z.string().regex(/^[A-Z]{3}$/, 'ISO 4217 kód kell (pl. EUR, HUF)').optional().describe('Pénznem (ISO 4217)'),
      eurAmount:   z.number().optional().describe('EUR-ban kifejezett bruttó összeg (ha az eredeti HUF)'),
      eurRate:     z.number().optional().describe('MNB középárfolyam az átváltáshoz (pl. 395.42)'),
    },
    async ({ id, category, status, notes, vendor, description, amount, vatAmount, totalAmount, currency, eurAmount, eurRate }) => {
      const updateData: Record<string, unknown> = {}
      if (category    !== undefined) updateData.category    = category    || null
      if (status      !== undefined) updateData.status      = status
      if (notes       !== undefined) updateData.notes       = notes       || null
      if (vendor      !== undefined) updateData.vendor      = vendor
      if (description !== undefined) updateData.description = description
      if (amount      !== undefined) updateData.amount      = amount
      if (vatAmount   !== undefined) updateData.vatAmount   = vatAmount
      if (totalAmount !== undefined) updateData.totalAmount = totalAmount
      if (currency    !== undefined) updateData.currency    = currency
      if (eurAmount   !== undefined) updateData.eurAmount   = eurAmount
      if (eurRate     !== undefined) updateData.eurRate     = eurRate
      const data = await prisma.expense.update({ where: { id }, data: updateData })
      const eurInfo = data.eurAmount ? ` | ≈ €${data.eurAmount} (${data.eurRate} HUF/EUR)` : ''
      return { content: [{ type: 'text', text: `Kiadás frissítve: ${data.vendor} — kategória: ${data.category ?? 'nincs'}${eurInfo}` }] }
    }
  )

  // ─── GYÁRTÁS: KÉSZLET ÖSSZESÍTŐ ──────────────────────────────────────────────

  server.tool(
    'get_low_stock_summary',
    'Összesítő: minden minimum alatti készletű termék, gyártópartnerenként csoportosítva. Rendelési javaslat összeállításához ideális.',
    {},
    async () => {
      const products = await prisma.$queryRaw<Array<{
        id: string; name: string; sku: string; city: string | null
        stock: number; minStock: number; unit: string; material: string | null
        costPrice: number; carrierId: string | null; carrierName: string | null; supplierName: string | null
      }>>`
        SELECT
          p.id, p.name, p.sku, p.city, p.stock, p."minStock", p.unit, p.material, p."costPrice",
          c.id AS "carrierId", c.name AS "carrierName",
          s.name AS "supplierName"
        FROM "Product" p
        LEFT JOIN "Carrier" c ON c.id = p.material
        LEFT JOIN "Supplier" s ON s.id = c."supplierId"
        WHERE p.active = true AND p.stock <= p."minStock"
        ORDER BY s.name ASC NULLS LAST, c.name ASC NULLS LAST, p.name ASC
      `
      if (products.length === 0) {
        return { content: [{ type: 'text', text: '✅ Minden termék készlete rendben van, nincs rendelési teendő.' }] }
      }
      const bySupplier: Record<string, typeof products> = {}
      for (const p of products) {
        const key = p.supplierName ?? '⚠️ Nincs gyártópartner'
        if (!bySupplier[key]) bySupplier[key] = []
        bySupplier[key].push(p)
      }
      const lines: string[] = [`🔴 ${products.length} termék minimum alatti készleten:\n`]
      for (const [supplier, items] of Object.entries(bySupplier)) {
        lines.push(`📦 ${supplier}`)
        for (const p of items) {
          const deficit = p.minStock - p.stock
          lines.push(`  • ${p.name} (${p.sku}) — készlet: ${p.stock}/${p.minStock} ${p.unit} → rendelendő: ${deficit} db`)
        }
        lines.push('')
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ─── GYÁRTÁS: GYÁRTÓPARTNEREK ─────────────────────────────────────────────────

  server.tool(
    'list_suppliers',
    'Gyártópartnerek listázása termék- és beszerzésirendelés-számmal.',
    {},
    async () => {
      const data = await prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { carriers: true, purchaseOrders: true } } },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_supplier',
    'Egy gyártópartner részletes adatai: hordozók és termékeik (városok szerint), legutóbbi beszerzési rendelések (beszerzőlapok), rendelendő (minimum alatti) termékek.',
    { id: z.string().describe('Gyártópartner ID') },
    async ({ id }) => {
      const data = await prisma.supplier.findUnique({
        where: { id },
        include: {
          carriers: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, code: true, name: true, nameDE: true, group: true },
          },
          purchaseOrders: {
            orderBy: { createdAt: 'desc' }, take: 5,
            include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
          },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Gyártópartner nem található.' }] }
      const carrierIds = data.carriers.map((c: { id: string }) => c.id)
      const products = carrierIds.length > 0
        ? await prisma.product.findMany({
            where: { material: { in: carrierIds }, active: true },
            orderBy: [{ city: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, nameDE: true, sku: true, city: true, stock: true, minStock: true, unit: true, costPrice: true, material: true },
          })
        : []
      const lowStock = products.filter((p: { stock: number; minStock: number }) => p.stock <= p.minStock)
      const summary = lowStock.length > 0
        ? `⚠️ ${lowStock.length} termék minimum alatti készleten: ${lowStock.map((p: { name: string; stock: number; minStock: number; unit: string }) => `${p.name} (${p.stock}/${p.minStock} ${p.unit})`).join(', ')}`
        : '✅ Minden termék rendben'
      const carriersWithProducts = data.carriers.map((c: { id: string }) => ({
        ...c,
        products: products.filter((p: { material: string | null }) => p.material === c.id),
      }))
      return { content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify({ ...data, carriers: carriersWithProducts }, null, 2)}` }] }
    }
  )

  server.tool(
    'create_supplier',
    'Új gyártópartner létrehozása a rendszerben.',
    {
      name:        z.string().describe('Cégnév'),
      contactName: z.string().optional().describe('Kapcsolattartó neve'),
      email:       z.string().optional(),
      phone:       z.string().optional(),
      address:     z.string().optional(),
      city:        z.string().optional(),
      zip:         z.string().optional(),
      country:     z.string().optional().describe('Országkód (pl. DE, AT, HU)'),
      website:     z.string().optional(),
      vatId:       z.string().optional().describe('Adószám'),
      notes:       z.string().optional(),
    },
    async (body) => {
      const data = await prisma.supplier.create({
        data: {
          name: body.name,
          contactName: body.contactName || null,
          email:       body.email       || null,
          phone:       body.phone       || null,
          address:     body.address     || null,
          city:        body.city        || null,
          zip:         body.zip         || null,
          country:     body.country     || 'DE',
          website:     body.website     || null,
          vatId:       body.vatId       || null,
          notes:       body.notes       || null,
        },
      })
      return { content: [{ type: 'text', text: `Gyártópartner létrehozva: ${data.name} (ID: ${data.id})` }] }
    }
  )

  server.tool(
    'update_supplier',
    'Gyártópartner adatainak módosítása.',
    {
      id:          z.string().describe('Gyártópartner ID'),
      name:        z.string().optional(),
      contactName: z.string().optional(),
      email:       z.string().optional(),
      phone:       z.string().optional(),
      address:     z.string().optional(),
      city:        z.string().optional(),
      zip:         z.string().optional(),
      country:     z.string().optional(),
      website:     z.string().optional(),
      vatId:       z.string().optional(),
      notes:       z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) upd[k] = v || null
      const data = await prisma.supplier.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Gyártópartner frissítve: ${data.name}` }] }
    }
  )

  server.tool(
    'assign_supplier_to_carrier',
    'Gyártópartner hozzárendelése egy hordozóhoz (Carrier). A hordozón keresztül a kapcsolódó termékek is a gyártópartnerhez tartoznak.',
    {
      carrierId:  z.string().describe('Hordozó ID'),
      supplierId: z.string().nullable().describe('Gyártópartner ID, vagy null a törléshez'),
    },
    async ({ carrierId, supplierId }) => {
      const carrier = await prisma.carrier.update({
        where: { id: carrierId },
        data: { supplierId: supplierId || null },
        select: { id: true, name: true, supplierId: true },
      })
      return { content: [{ type: 'text', text: supplierId ? `Gyártópartner hozzárendelve a hordozóhoz: ${carrier.name}` : `Gyártópartner eltávolítva a hordozóról: ${carrier.name}` }] }
    }
  )

  // ─── GYÁRTÁS: BESZERZÉSI RENDELÉSEK ───────────────────────────────────────────

  server.tool(
    'list_purchase_orders',
    'Beszerzési rendelések (beszerzőlapok) listázása — ezek a Memini → gyártópartner felé induló rendelések, NEM a vevői megrendelések (azokhoz lásd: list_orders / get_order). Szűrhető gyártópartner és státusz szerint.',
    {
      supplierId: z.string().optional().describe('Gyártópartner ID'),
      status:     z.enum(['draft', 'sent', 'confirmed', 'received', 'cancelled']).optional(),
    },
    async ({ supplierId, status }) => {
      const where: Record<string, unknown> = {}
      if (supplierId) where.supplierId = supplierId
      if (status)     where.status     = status
      const data = await prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_purchase_order',
    'Egy beszerzési rendelés (beszerzőlap) teljes tartalma tételekkel együtt — ez a Memini → gyártópartner felé induló rendelés, NEM vevői megrendelés.',
    { id: z.string().describe('Beszerzési rendelés ID') },
    async ({ id }) => {
      const data = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: { include: { product: { select: { id: true, name: true, nameDE: true, sku: true, unit: true, city: true } } } },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Beszerzési rendelés nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_purchase_order',
    'Új beszerzési rendelés (beszerzőlap) létrehozása gyártópartnerhez — ez a Memini saját utánrendelése a gyártótól, NEM vevői megrendelőlap (ahhoz lásd: create_order). Termékeket ID + mennyiség alapján add meg.',
    {
      supplierId: z.string().describe('Gyártópartner ID'),
      notes:      z.string().optional().describe('Megjegyzés'),
      items:      z.array(z.object({
        productId: z.string().describe('Termék ID'),
        quantity:  z.number().int().positive().describe('Rendelt mennyiség'),
        unitPrice: z.number().optional().describe('Egységár (alapértelmezett: termék önköltsége)'),
        note:      z.string().optional(),
      })).min(1).describe('Rendelési tételek'),
    },
    async ({ supplierId, notes, items }) => {
      const year = new Date().getFullYear()
      const count = await prisma.purchaseOrder.count({ where: { number: { startsWith: `PO-${year}-` } } })
      const number = `PO-${year}-${String(count + 1).padStart(4, '0')}`

      // Fill missing unitPrices from product costPrice
      const productIds = items.map(i => i.productId)
      const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, costPrice: true, name: true } })
      const priceMap = Object.fromEntries(products.map(p => [p.id, p.costPrice]))

      const order = await prisma.purchaseOrder.create({
        data: {
          number,
          supplierId,
          status: 'draft',
          notes: notes || null,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice ?? priceMap[item.productId] ?? 0,
              note:      item.note || null,
            })),
          },
        },
        include: { supplier: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      })

      const lines = order.items.map(i => `  • ${i.product.name}: ${i.quantity}`).join('\n')
      return { content: [{ type: 'text', text: `Beszerzési rendelés (beszerzőlap) létrehozva: ${order.number}\nGyártópartner: ${order.supplier.name}\nTételek:\n${lines}` }] }
    }
  )

  server.tool(
    'update_purchase_order_status',
    'Beszerzési rendelés (beszerzőlap) státuszának frissítése — a gyártópartner felé induló rendelésé, NEM a vevői megrendelésé. Lehetséges átmenetek: draft→sent→confirmed (vagy cancelled). KORLÁT: a "received" (megérkezett) státuszt az MCP nem állíthatja be — raktári átvételt csak a webes felületen lehet rögzíteni.',
    {
      id:     z.string().describe('Beszerzési rendelés ID'),
      status: z.enum(['draft', 'sent', 'confirmed', 'cancelled']).describe('Engedélyezett státuszok. A "received" az MCP-n keresztül nem érhető el.'),
      notes:  z.string().optional().describe('Megjegyzés hozzáadása / módosítása'),
    },
    async ({ id, status, notes }) => {
      const upd: Record<string, unknown> = { status }
      if (notes !== undefined) upd.notes = notes
      if (status === 'sent') upd.orderedAt = new Date()
      const data = await prisma.purchaseOrder.update({ where: { id }, data: upd, select: { number: true, status: true } })
      return { content: [{ type: 'text', text: `Beszerzési rendelés frissítve: ${data.number} → ${data.status}` }] }
    }
  )

  // ─── AKTIVITÁSOK ─────────────────────────────────────────────────────────────

  server.tool(
    'list_activities',
    'Aktivitások (telefon, email, találkozó stb.) listázása. Szűrhető cég, kapcsolat vagy deal alapján. Tartalmazza az utolsó aktivitás dátumát és az inaktív napok számát.',
    {
      companyId:  z.string().optional().describe('Cég ID'),
      contactId:  z.string().optional().describe('Kapcsolat ID'),
      dealId:     z.string().optional().describe('Deal ID'),
      type:       z.enum(['call', 'email', 'meeting', 'whatsapp', 'note']).optional(),
    },
    async ({ companyId, contactId, dealId, type }) => {
      const where: Record<string, unknown> = {}
      if (companyId) where.companyId = companyId
      if (contactId) where.contactId = contactId
      if (dealId)    where.dealId    = dealId
      if (type)      where.type      = type
      const data = await prisma.activity.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          deal:    { select: { id: true, title: true } },
        },
        orderBy: { activityDate: 'desc' },
      })
      const lastDate = data[0]?.activityDate
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        : null
      const dormancyNote = daysSince === null
        ? 'Nincs aktivitás rögzítve.'
        : daysSince >= 28
          ? `⚠️ FIGYELEM: ${daysSince} napja nincs aktivitás (4+ hét) — feladat szükséges!`
          : daysSince >= 21
            ? `🟡 Figyelem: ${daysSince} napja nincs aktivitás (3+ hét)`
            : `✅ Utolsó aktivitás: ${daysSince} napja`
      return { content: [{ type: 'text', text: `${dormancyNote}\n\n${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'create_activity',
    'Új aktivitás rögzítése egy céghez, kapcsolathoz vagy dealhez. Típusok: call (telefon), email, meeting (találkozó), whatsapp, note (feljegyzés).',
    {
      type:         z.enum(['call', 'email', 'meeting', 'whatsapp', 'note']).describe('Aktivitás típusa'),
      description:  z.string().describe('Mit, miről, mi történt?'),
      subject:      z.string().optional().describe('Tárgy (rövid összefoglaló)'),
      activityDate: z.string().optional().describe('Dátum és idő (ISO 8601 vagy YYYY-MM-DD), alapértelmezett: most'),
      duration:     z.number().optional().describe('Időtartam percben (telefon/találkozó esetén)'),
      outcome:      z.string().optional().describe('Eredmény (pl. "Ajánlatot kér", "Visszahív")'),
      companyId:    z.string().optional().describe('Cég ID'),
      contactId:    z.string().optional().describe('Kapcsolat ID'),
      dealId:       z.string().optional().describe('Deal ID'),
    },
    async ({ type, description, subject, activityDate, duration, outcome, companyId, contactId, dealId }) => {
      const data = await prisma.activity.create({
        data: {
          type,
          description,
          subject:      subject      || null,
          activityDate: activityDate ? new Date(activityDate) : new Date(),
          duration:     duration     ?? null,
          outcome:      outcome      || null,
          companyId:    companyId    || null,
          contactId:    contactId    || null,
          dealId:       dealId       || null,
        },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      const who = data.company?.name ?? `${data.contact?.firstName ?? ''} ${data.contact?.lastName ?? ''}`.trim() ?? 'ismeretlen'
      return { content: [{ type: 'text', text: `Aktivitás rögzítve: ${type} — ${who} — ${data.activityDate.toISOString().slice(0, 10)}` }] }
    }
  )

  server.tool(
    'update_activity',
    'Meglévő aktivitás szerkesztése (leírás, tárgy, dátum, eredmény, típus).',
    {
      id:           z.string().describe('Aktivitás ID'),
      type:         z.enum(['call', 'email', 'meeting', 'whatsapp', 'note']).optional(),
      description:  z.string().optional(),
      subject:      z.string().optional(),
      activityDate: z.string().optional().describe('ISO 8601 dátum'),
      duration:     z.number().optional(),
      outcome:      z.string().optional(),
    },
    async ({ id, type, description, subject, activityDate, duration, outcome }) => {
      const upd: Record<string, unknown> = {}
      if (type         !== undefined) upd.type         = type
      if (description  !== undefined) upd.description  = description
      if (subject      !== undefined) upd.subject      = subject      || null
      if (activityDate !== undefined) upd.activityDate = new Date(activityDate)
      if (duration     !== undefined) upd.duration     = duration     ?? null
      if (outcome      !== undefined) upd.outcome      = outcome      || null
      const data = await prisma.activity.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Aktivitás frissítve: ${data.type} — ${data.activityDate.toISOString().slice(0, 10)}` }] }
    }
  )

  // ─── MEMÓRIA ─────────────────────────────────────────────────────────────────

  server.tool(
    'list_memory_types',
    'Memória-bejegyzés típusok listázása (címke, ikon, szín). A create_memory / update_memory typeId mezőjéhez szükséges.',
    {},
    async () => {
      const data = await prisma.memoryEntryType.findMany({ orderBy: { order: 'asc' } })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'list_memories',
    'Memória-bejegyzések listázása egy céghez vagy kapcsolathoz. A Memoria a lényeges tudnivalók (preferenciák, megállapodások, fontos részletek) gyűjtőhelye a cég/kapcsolat adatlapján.',
    {
      companyId: z.string().optional().describe('Cég ID'),
      contactId: z.string().optional().describe('Kapcsolat ID'),
    },
    async ({ companyId, contactId }) => {
      if (!companyId && !contactId) {
        return { content: [{ type: 'text', text: 'Adj meg companyId-t vagy contactId-t.' }] }
      }
      const where: Record<string, string> = {}
      if (companyId) where.companyId = companyId
      if (contactId) where.contactId = contactId
      const data = await prisma.memoryEntry.findMany({
        where,
        include: { type: true },
        orderBy: { createdAt: 'desc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_memory',
    'Új memória-bejegyzés rögzítése egy céghez vagy kapcsolathoz. A típus megadható typeId-vel vagy typeLabel-lel (pl. "Preferencia") — a típusok a list_memory_types tool-lal kérdezhetők le. A bejegyzés "mcp" forrásjelöléssel jelenik meg a felületen.',
    {
      content:   z.string().describe('A bejegyzés szövege'),
      companyId: z.string().optional().describe('Cég ID (companyId vagy contactId kötelező)'),
      contactId: z.string().optional().describe('Kapcsolat ID'),
      typeId:    z.string().optional().describe('Memória-típus ID'),
      typeLabel: z.string().optional().describe('Memória-típus címkéje typeId helyett (pontos vagy részleges egyezés)'),
      date:      z.string().optional().describe('A bejegyzéshez tartozó dátum YYYY-MM-DD (opcionális)'),
    },
    async ({ content, companyId, contactId, typeId, typeLabel, date }) => {
      if (!companyId && !contactId) {
        return { content: [{ type: 'text', text: 'Adj meg companyId-t vagy contactId-t.' }] }
      }
      let resolvedTypeId = typeId
      if (!resolvedTypeId && typeLabel) {
        const type = await prisma.memoryEntryType.findFirst({
          where: { label: { contains: typeLabel } },
          orderBy: { order: 'asc' },
        })
        if (!type) {
          const types = await prisma.memoryEntryType.findMany({ orderBy: { order: 'asc' }, select: { id: true, label: true } })
          return { content: [{ type: 'text', text: `Nincs "${typeLabel}" nevű memória-típus. Elérhető típusok:\n${types.map(t => `  • ${t.label} (${t.id})`).join('\n')}` }] }
        }
        resolvedTypeId = type.id
      }
      if (!resolvedTypeId) {
        return { content: [{ type: 'text', text: 'Adj meg typeId-t vagy typeLabel-t (típusok: list_memory_types).' }] }
      }
      const data = await prisma.memoryEntry.create({
        data: {
          companyId: companyId || null,
          contactId: contactId || null,
          typeId:    resolvedTypeId,
          content,
          date:      date ? new Date(date) : null,
          source:    'mcp',
        },
        include: { type: true, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
      })
      const who = data.company?.name ?? `${data.contact?.firstName ?? ''} ${data.contact?.lastName ?? ''}`.trim()
      return { content: [{ type: 'text', text: `Memória rögzítve (${data.type.label}) — ${who} — ID: ${data.id}` }] }
    }
  )

  server.tool(
    'update_memory',
    'Meglévő memória-bejegyzés módosítása. Csak a megadott mezők frissülnek.',
    {
      id:        z.string().describe('Memória-bejegyzés ID'),
      content:   z.string().optional().describe('Új szöveg'),
      typeId:    z.string().optional().describe('Új memória-típus ID'),
      date:      z.string().optional().describe('Új dátum YYYY-MM-DD, vagy üres string a törléshez'),
    },
    async ({ id, content, typeId, date }) => {
      const upd: Record<string, unknown> = {}
      if (content !== undefined) upd.content = content
      if (typeId  !== undefined) upd.typeId  = typeId
      if (date    !== undefined) upd.date    = date ? new Date(date) : null
      const data = await prisma.memoryEntry.update({
        where: { id },
        data: upd,
        include: { type: true },
      })
      return { content: [{ type: 'text', text: `Memória frissítve (${data.type.label}): ${data.content.slice(0, 80)}` }] }
    }
  )

  server.tool(
    'delete_memory',
    'Memória-bejegyzés végleges törlése ID alapján.',
    { id: z.string().describe('Memória-bejegyzés ID') },
    async ({ id }) => {
      const data = await prisma.memoryEntry.findUnique({ where: { id }, select: { content: true } })
      if (!data) return { content: [{ type: 'text', text: 'Memória-bejegyzés nem található.' }] }
      await prisma.memoryEntry.delete({ where: { id } })
      return { content: [{ type: 'text', text: `Memória törölve: ${data.content.slice(0, 80)}` }] }
    }
  )

  // ─── MARKETING: ÍV & TÉMÁK (V1/V2) ───────────────────────────────────────────

  server.tool(
    'get_marketing_tree',
    'A teljes marketing-ív egy hívásban, kiszámolt telítettséggel: hosszú távú (vision) → éves → negyedéves → havi szintek, mindegyiknél a kadencia (heti hány tartalom csatornánként) és a telítettség %-a (tervezett vs. ütemezett tartalom). MINDIG ezzel kezdd, mielőtt marketing-ívet, témát vagy tartalmat kezelsz — ez adja a stratégiai és időbeli kontextust.',
    { includeArchived: z.boolean().optional().describe('Archivált ívek is (alapértelmezett: nem)') },
    async ({ includeArchived }) => {
      const tree = await buildMarketingTree({ includeArchived })
      if (tree.length === 0) {
        return { content: [{ type: 'text', text: 'Még nincs marketing-ív felvéve. A create_marketing_arc tool-lal hozható létre — kezdd a vision szinttel.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] }
    }
  )

  server.tool(
    'create_marketing_arc',
    'Új marketing-ív szint létrehozása. Szintek: vision (hosszú távú, nincs éve) → yearly (year kötelező) → quarterly (year + quarter) → monthly (year + month). A parentId köti a szülőhöz. A cadence a heti tartalom-terv csatornánként, pl. { "blog": 3, "linkedin": 2 } — ebből számítódik a telítettség.',
    {
      title:         z.string(),
      level:         z.enum(ARC_LEVELS as unknown as [string, ...string[]]),
      description:   z.string().optional(),
      year:          z.number().int().min(2020).max(2040).optional(),
      quarter:       z.number().int().min(1).max(4).optional(),
      month:         z.number().int().min(1).max(12).optional(),
      parentId:      z.string().optional(),
      strategicArea: z.string().optional(),
      cadence:       z.record(z.string(), z.number()).optional().describe('Heti darab csatornánként, pl. { "blog": 3 }'),
      goalId:        z.string().optional().describe('Opcionális kötés az éves üzleti célra'),
    },
    async (body) => {
      if (body.level !== 'vision' && !body.year) return { content: [{ type: 'text', text: 'Az év kötelező ezen a szinten.' }] }
      if (body.level === 'quarterly' && !body.quarter) return { content: [{ type: 'text', text: 'Negyedéves ívhez a quarter (1-4) kötelező.' }] }
      if (body.level === 'monthly' && !body.month) return { content: [{ type: 'text', text: 'Havi ívhez a month (1-12) kötelező.' }] }
      if (body.parentId) {
        const parent = await prisma.marketingArc.findUnique({ where: { id: body.parentId }, select: { id: true } })
        if (!parent) return { content: [{ type: 'text', text: `Nincs ilyen szülő-ív: ${body.parentId}` }] }
      }
      const arc = await prisma.marketingArc.create({
        data: {
          title: body.title,
          description: body.description || null,
          level: body.level,
          year: body.level === 'vision' ? null : body.year,
          quarter: body.level === 'quarterly' ? body.quarter : null,
          month: body.level === 'monthly' ? body.month : null,
          strategicArea: body.strategicArea || null,
          cadence: body.cadence ?? undefined,
          goalId: body.goalId || null,
          parentId: body.parentId || null,
        },
      })
      return { content: [{ type: 'text', text: `Marketing-ív létrehozva (${arc.level}): ${arc.title} — ID: ${arc.id}` }] }
    }
  )

  server.tool(
    'update_marketing_arc',
    'Marketing-ív módosítása: cím, leírás, státusz, kadencia, stratégiai terület, üzleti cél. Csak a megadott mezők frissülnek. A szint nem módosítható.',
    {
      id:            z.string(),
      title:         z.string().optional(),
      description:   z.string().optional(),
      status:        z.enum(['active', 'achieved', 'missed', 'dropped']).optional(),
      strategicArea: z.string().optional(),
      cadence:       z.record(z.string(), z.number()).optional(),
      goalId:        z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const arc = await prisma.marketingArc.findUnique({ where: { id }, select: { id: true } })
      if (!arc) return { content: [{ type: 'text', text: 'Marketing-ív nem található.' }] }
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        upd[k] = (k === 'description' || k === 'strategicArea' || k === 'goalId') ? (v || null) : v
      }
      const data = await prisma.marketingArc.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Marketing-ív frissítve: ${data.title} (${data.status})` }] }
    }
  )

  server.tool(
    'archive_marketing_arc',
    'Marketing-ív archiválása — eltűnik a fából, de nem törlődik. KORLÁT: vision és yearly szintű ívet az MCP nem archiválhat — a stratégiai gerincet csak a webes felületen lehet módosítani. Végleges törlés az MCP-n keresztül nincs.',
    { id: z.string(), reason: z.string().optional() },
    async ({ id, reason }) => {
      const arc = await prisma.marketingArc.findUnique({
        where: { id },
        select: { id: true, title: true, level: true, children: { where: { archivedAt: null }, select: { id: true } } },
      })
      if (!arc) return { content: [{ type: 'text', text: 'Marketing-ív nem található.' }] }
      if (arc.level === 'vision' || arc.level === 'yearly') {
        return { content: [{ type: 'text', text: `A(z) ${arc.level} szintű ív archiválása az MCP-n keresztül nem engedélyezett — csak a webes felületen.` }] }
      }
      if (arc.children.length > 0) {
        return { content: [{ type: 'text', text: `Az ívnek ${arc.children.length} aktív al-szintje van — előbb azokat kell kezelni.` }] }
      }
      await prisma.marketingArc.update({ where: { id }, data: { archivedAt: new Date() } })
      return { content: [{ type: 'text', text: `Marketing-ív archiválva: ${arc.title}${reason ? ` — indok: ${reason}` : ''}` }] }
    }
  )

  server.tool(
    'create_content_theme',
    'Új téma ("kör") létrehozása egy marketing-ív alá: a mondanivaló (message) és a struktúra/részek (outline) rögzítése. A témából származnak a konkrét tartalmak. Állapotok: planned → approved → active → done.',
    {
      title:     z.string(),
      arcId:     z.string().optional().describe('A marketing-ív ID, amihez a téma tartozik'),
      message:   z.string().optional().describe('A mondanivaló / core message'),
      outline:   z.string().optional().describe('A struktúra / részek (markdown)'),
      status:    z.enum(['planned', 'approved', 'active', 'done']).optional(),
      startDate: z.string().optional().describe('YYYY-MM-DD'),
      endDate:   z.string().optional().describe('YYYY-MM-DD'),
    },
    async (body) => {
      if (body.arcId) {
        const arc = await prisma.marketingArc.findUnique({ where: { id: body.arcId }, select: { id: true } })
        if (!arc) return { content: [{ type: 'text', text: `Nincs ilyen marketing-ív: ${body.arcId}` }] }
      }
      const theme = await prisma.contentTheme.create({
        data: {
          title: body.title,
          message: body.message || null,
          outline: body.outline || null,
          status: body.status || 'planned',
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          arcId: body.arcId || null,
        },
      })
      return { content: [{ type: 'text', text: `Téma létrehozva: ${theme.title} (${theme.status}) — ID: ${theme.id}` }] }
    }
  )

  server.tool(
    'update_content_theme',
    'Téma módosítása: cím, mondanivaló, vázlat, állapot, időablak, ív-kötés. Csak a megadott mezők frissülnek.',
    {
      id:        z.string(),
      title:     z.string().optional(),
      message:   z.string().optional(),
      outline:   z.string().optional(),
      status:    z.enum(['planned', 'approved', 'active', 'done']).optional(),
      arcId:     z.string().optional(),
      startDate: z.string().optional(),
      endDate:   z.string().optional(),
    },
    async ({ id, startDate, endDate, ...fields }) => {
      const theme = await prisma.contentTheme.findUnique({ where: { id }, select: { id: true } })
      if (!theme) return { content: [{ type: 'text', text: 'Téma nem található.' }] }
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        upd[k] = (k === 'message' || k === 'outline' || k === 'arcId') ? (v || null) : v
      }
      if (startDate !== undefined) upd.startDate = startDate ? new Date(startDate) : null
      if (endDate !== undefined) upd.endDate = endDate ? new Date(endDate) : null
      const data = await prisma.contentTheme.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Téma frissítve: ${data.title} (${data.status})` }] }
    }
  )

  // ─── MARKETING: TARTALMAK (V1/V2) ────────────────────────────────────────────

  const channelEnum = z.enum(CHANNEL_KEYS as [string, ...string[]])
  const langEnum = z.enum(LANGUAGES.map(l => l.key) as [string, ...string[]])

  server.tool(
    'list_content_pieces',
    'Tartalmak listázása. Szűrhető csatorna, státusz, téma, ív és ütemezési dátum-tartomány szerint. Csatornák: blog, linkedin, facebook, instagram, newsletter, pinterest. A tartalom három nyelvet tart (bodyDe elsődleges, bodyHu, bodyEn).',
    {
      channel: channelEnum.optional(),
      status:  z.enum(['draft', 'ready', 'scheduled', 'published', 'archived']).optional(),
      themeId: z.string().optional(),
      arcId:   z.string().optional(),
      from:    z.string().optional().describe('Ütemezés ettől, YYYY-MM-DD'),
      to:      z.string().optional().describe('Ütemezés eddig, YYYY-MM-DD'),
    },
    async ({ channel, status, themeId, arcId, from, to }) => {
      const where: Record<string, unknown> = {}
      if (channel) where.channel = channel
      if (status) where.status = status
      else where.status = { not: 'archived' }
      if (themeId) where.themeId = themeId
      if (arcId) where.arcId = arcId
      if (from || to) where.scheduledFor = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) }
      const data = await prisma.contentPiece.findMany({
        where,
        include: {
          theme: { select: { id: true, title: true } },
          parentPiece: { select: { id: true, title: true, channel: true } },
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_content_piece',
    'Egy tartalom teljes lekérése — mindhárom nyelvű törzs, származtatott gyerekek és a legutóbbi eseménytörténet.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.contentPiece.findUnique({
        where: { id },
        include: {
          theme: { select: { id: true, title: true } },
          arc: { select: { id: true, title: true } },
          parentPiece: { select: { id: true, title: true, channel: true } },
          derivedPieces: { select: { id: true, title: true, channel: true, status: true } },
          events: { orderBy: { createdAt: 'desc' }, take: 15 },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Tartalom nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_content_piece',
    'Új tartalom létrehozása. A szöveget a megfelelő nyelvi mezőbe írd (bodyDe = német/elsődleges, bodyHu, bodyEn). Csatorna-származtatáshoz (pl. blogból LinkedIn) add meg a parentPieceId-t; témához/ívhez a themeId/arcId-t; ütemezéshez a scheduledFor-t. KORLÁT: a "published" státuszt az MCP nem állíthatja — publikálni csak a webes felületen lehet. A tartalom "agent" forrásjelöléssel jön létre és naplózódik.',
    {
      title:         z.string(),
      channel:       channelEnum,
      bodyDe:        z.string().optional().describe('Német törzsszöveg (elsődleges)'),
      bodyHu:        z.string().optional(),
      bodyEn:        z.string().optional(),
      status:        z.enum(['draft', 'ready', 'scheduled']).optional().describe('published nem engedélyezett'),
      scheduledFor:  z.string().optional().describe('Ütemezés dátuma, YYYY-MM-DD'),
      themeId:       z.string().optional(),
      arcId:         z.string().optional().describe('Ad-hoc: közvetlenül egy ív-hónaphoz tűzve, téma nélkül'),
      parentPieceId: z.string().optional().describe('Csatorna-származtatás szülője (pl. a blog, amiből ez készült)'),
      slug:          z.string().optional().describe('Weboldal-kész URL-slug (blognál hasznos)'),
      imagePrompt:   z.string().optional().describe('Vizuális koncepció / kép-prompt'),
    },
    async (body) => {
      if (body.themeId) {
        const t = await prisma.contentTheme.findUnique({ where: { id: body.themeId }, select: { id: true } })
        if (!t) return { content: [{ type: 'text', text: `Nincs ilyen téma: ${body.themeId}` }] }
      }
      const piece = await prisma.contentPiece.create({
        data: {
          title: body.title,
          channel: body.channel,
          bodyDe: body.bodyDe || null,
          bodyHu: body.bodyHu || null,
          bodyEn: body.bodyEn || null,
          status: body.status || 'draft',
          source: 'agent',
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
          themeId: body.themeId || null,
          arcId: body.arcId || null,
          parentPieceId: body.parentPieceId || null,
          slug: body.slug || null,
          imagePrompt: body.imagePrompt || null,
        },
        include: { theme: { select: { title: true } } },
      })
      await logPieceCreated(piece.id, 'agent', body.parentPieceId ? 'derived' : 'created')
      return { content: [{ type: 'text', text: `Tartalom létrehozva: ${piece.title} (${piece.channel}) — ID: ${piece.id}` }] }
    }
  )

  server.tool(
    'update_content_piece',
    'Tartalom módosítása: cím, bármelyik nyelvi törzs (bodyDe/bodyHu/bodyEn — lokalizációhoz ideális), csatorna, státusz, ütemezés, téma/ív/szülő kötés, slug. Csak a megadott mezők frissülnek; minden változás naplózódik. KORLÁT: a "published" státuszt az MCP nem állíthatja — publikálni csak a webes felületen lehet.',
    {
      id:            z.string(),
      title:         z.string().optional(),
      channel:       channelEnum.optional(),
      bodyDe:        z.string().optional(),
      bodyHu:        z.string().optional(),
      bodyEn:        z.string().optional(),
      status:        z.enum(['draft', 'ready', 'scheduled']).optional().describe('published nem engedélyezett'),
      scheduledFor:  z.string().optional().describe('YYYY-MM-DD, vagy üres string a törléshez'),
      themeId:       z.string().optional(),
      arcId:         z.string().optional(),
      slug:          z.string().optional(),
      imagePrompt:   z.string().optional(),
      focused:       z.boolean().optional().describe('Fókuszba emelés (a Fókusz nézet tetején jelenik meg)'),
    },
    async ({ id, scheduledFor, focused, ...fields }) => {
      const before = await prisma.contentPiece.findUnique({ where: { id } })
      if (!before) return { content: [{ type: 'text', text: 'Tartalom nem található.' }] }
      const upd: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue
        upd[k] = (k === 'title' || k === 'channel' || k === 'status') ? v : (v || null)
      }
      if (focused !== undefined) upd.focused = focused
      if (scheduledFor !== undefined) upd.scheduledFor = scheduledFor ? new Date(scheduledFor) : null
      const data = await prisma.contentPiece.update({ where: { id }, data: upd })
      await logPieceDiff(id, 'agent', before, data)
      return { content: [{ type: 'text', text: `Tartalom frissítve: ${data.title} → ${data.status}` }] }
    }
  )

  server.tool(
    'schedule_content_piece',
    'Tartalom ütemezése egy dátumra (a naptárra kerül) és a státusz "scheduled"-re állítása. Az ütemezés naplózódik.',
    {
      id:   z.string(),
      date: z.string().describe('Ütemezés dátuma, YYYY-MM-DD'),
    },
    async ({ id, date }) => {
      const before = await prisma.contentPiece.findUnique({ where: { id } })
      if (!before) return { content: [{ type: 'text', text: 'Tartalom nem található.' }] }
      const data = await prisma.contentPiece.update({
        where: { id },
        data: { scheduledFor: new Date(date), status: before.status === 'draft' ? 'scheduled' : before.status },
      })
      await logPieceDiff(id, 'agent', before, data)
      return { content: [{ type: 'text', text: `Tartalom ütemezve: ${data.title} → ${date}` }] }
    }
  )

  server.tool(
    'archive_content_piece',
    'Tartalom archiválása (eltűnik a listákból/naptárból, de nem törlődik). Végleges törlés az MCP-n keresztül nincs — az csak a webes felületen.',
    { id: z.string(), reason: z.string().optional() },
    async ({ id, reason }) => {
      const before = await prisma.contentPiece.findUnique({ where: { id }, select: { title: true, status: true } })
      if (!before) return { content: [{ type: 'text', text: 'Tartalom nem található.' }] }
      await prisma.contentPiece.update({ where: { id }, data: { status: 'archived' } })
      await logPieceEvent(id, 'agent', 'archived', 'status', before.status, reason ? `archived (${reason})` : 'archived')
      return { content: [{ type: 'text', text: `Tartalom archiválva: ${before.title}` }] }
    }
  )

  // ─── MARKETING: KÉPEK (V1/V2) ────────────────────────────────────────────────

  server.tool(
    'attach_content_image',
    'Kép hozzáadása egy tartalomhoz URL alapján. A szerver letölti a képet, WebP-be konvertálja (helytakarékos) és tárolja. Az első kép automatikusan borító lesz. Adj meg egy publikusan elérhető kép-URL-t (JPEG/PNG/WebP/HEIC).',
    {
      pieceId:  z.string().describe('A tartalom ID-ja'),
      imageUrl: z.string().describe('Publikusan elérhető kép-URL, amit a szerver letölt és WebP-be konvertál'),
      altDe:    z.string().optional().describe('Alt-szöveg németül (weboldal-SEO, opcionális)'),
      altHu:    z.string().optional(),
      altEn:    z.string().optional(),
    },
    async ({ pieceId, imageUrl, altDe, altHu, altEn }) => {
      const piece = await prisma.contentPiece.findUnique({ where: { id: pieceId }, select: { id: true } })
      if (!piece) return { content: [{ type: 'text', text: 'Tartalom nem található.' }] }
      try {
        const img = await ingestImageFromUrl(pieceId, imageUrl, 'agent')
        if (altDe || altHu || altEn) {
          await prisma.contentImage.update({ where: { id: img.id }, data: { altDe: altDe || null, altHu: altHu || null, altEn: altEn || null } })
        }
        await logPieceEvent(pieceId, 'agent', 'image_added', 'image', null, `${Math.round(img.bytes / 1024)} KB WebP`)
        return { content: [{ type: 'text', text: `Kép hozzáadva és WebP-be konvertálva (${img.width}×${img.height}, ${Math.round(img.bytes / 1024)} KB) — ID: ${img.id}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Kép hozzáadása sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}` }] }
      }
    }
  )

  server.tool(
    'list_content_images',
    'Egy tartalom képeinek listázása (borító elöl).',
    { pieceId: z.string() },
    async ({ pieceId }) => {
      const images = await prisma.contentImage.findMany({
        where: { pieceId },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { id: true, url: true, isPrimary: true, altDe: true, altHu: true, altEn: true, width: true, height: true, bytes: true },
      })
      return { content: [{ type: 'text', text: JSON.stringify(images, null, 2) }] }
    }
  )

  server.tool(
    'set_image_alt',
    'Kép alt-szövegének beállítása nyelvenként (weboldal-SEO). Csak a megadott nyelvek frissülnek.',
    {
      id:    z.string().describe('Kép ID'),
      altDe: z.string().optional(),
      altHu: z.string().optional(),
      altEn: z.string().optional(),
    },
    async ({ id, altDe, altHu, altEn }) => {
      const upd: Record<string, unknown> = {}
      if (altDe !== undefined) upd.altDe = altDe || null
      if (altHu !== undefined) upd.altHu = altHu || null
      if (altEn !== undefined) upd.altEn = altEn || null
      const img = await prisma.contentImage.update({ where: { id }, data: upd })
      return { content: [{ type: 'text', text: `Alt-szöveg frissítve (kép: ${img.id})` }] }
    }
  )

  server.tool(
    'set_primary_image',
    'Borítókép kijelölése egy tartalomhoz (ez lesz az előnézet/gyorshivatkozás).',
    { id: z.string().describe('Kép ID') },
    async ({ id }) => {
      await setPrimaryImage(id)
      return { content: [{ type: 'text', text: 'Borítókép beállítva.' }] }
    }
  )

  server.tool(
    'remove_content_image',
    'Kép törlése egy tartalomból (a tárhelyből is). Ha borító volt, a következő kép lesz az új borító.',
    { id: z.string().describe('Kép ID') },
    async ({ id }) => {
      await deleteContentImage(id)
      return { content: [{ type: 'text', text: 'Kép törölve.' }] }
    }
  )

  // ─── LEVELEK ─────────────────────────────────────────────────────────────

  server.tool(
    'list_unanswered_emails',
    'Válaszra váró beszélgetések, PRIORITÁS szerint bontva. A "priority" lista a napi vezérlőlista: partnerhez kötött ÉS friss (3 hónapon belüli) szálak — ezekkel érdemes foglalkozni. Az "other" a többi unanswered szál: partner nélküli vagy elévült — ezek gyakran zaj (a levélosztályozó csak fejlécből dolgozik, így hírlevél is bekerülhet), külön nézd át. A counts megmutatja, mennyi esik melyik csoportba. Opcionálisan cégre szűrhető.',
    {
      companyId: z.string().optional(),
      includeOther: z.boolean().optional().describe('Az elévült / partner nélküli szálak is (alap: false — csak a prioritás)'),
      limit: z.number().int().min(1).max(100).optional().describe('Alap: 25'),
    },
    async ({ companyId, includeOther, limit }) => {
      const pending = await computePendingReplies({ companyId })
      const cap = limit ?? 25
      const result = {
        counts: pending.counts,
        priority: pending.priority.slice(0, cap),
        ...(includeOther ? { other: pending.other.slice(0, cap) } : {}),
        note: includeOther
          ? undefined
          : `${pending.counts.total} unanswered szálból ${pending.counts.priority} a partnerhez kötött friss (priority). A többi (${pending.counts.total - pending.counts.priority}) partner nélküli vagy 3 hónapnál régebbi — includeOther: true ha az is kell.`,
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'list_recent_emails',
    'A legutóbbi levélszálak időrendben (LEGÚJABB elöl). Erre kérdezz rá, ha "mi jött ma/tegnap". Alapból csak valódi beszélgetés; includeNoise=true az automata/hírlevél leveleket is hozza. A direction paraméterrel szűrhető: "outbound" = amit MI küldtünk, "inbound" = ami érkezett.',
    {
      days: z.number().int().min(1).max(90).optional().describe('Csak az elmúlt N nap'),
      limit: z.number().int().min(1).max(100).optional().describe('Alap: 25'),
      includeNoise: z.boolean().optional().describe('true esetén az automata/hírlevél is'),
      direction: z.enum(['inbound', 'outbound']).optional().describe('Csak bejövő vagy csak kimenő levelet tartalmazó szálak'),
    },
    async ({ days, limit, includeNoise, direction }) => {
      const where: Record<string, unknown> = {}
      if (!includeNoise) where.category = 'conversation'
      if (days) where.lastMessageAt = { gte: new Date(Date.now() - days * 86400000) }
      if (direction) where.emails = { some: { direction } }
      const data = await prisma.emailThread.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: limit ?? 25,
        select: {
          id: true, subject: true, replyStatus: true, category: true, lastMessageAt: true,
          company: { select: { id: true, name: true } },
          emails: {
            orderBy: { sentAt: 'desc' }, take: 1,
            select: {
              direction: true, snippet: true,
              participants: { select: { type: true, emailAddress: true, displayName: true } },
            },
          },
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'search_emails',
    'Keresés a levelekben tárgy és tartalom alapján. Visszaadja a találó szálakat.',
    {
      query: z.string().describe('Keresőszó a tárgyban vagy a levél szövegében'),
      companyId: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ query, companyId, limit }) => {
      const data = await prisma.emailThread.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { emails: { some: { textBody: { contains: query, mode: 'insensitive' } } } },
          ],
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit ?? 25,
        select: {
          id: true, subject: true, replyStatus: true, lastMessageAt: true,
          company: { select: { id: true, name: true } },
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_email_thread',
    'Egy teljes levélszál időrendben: minden levél (feladó, irány, szöveg), résztvevők és a hozzá tartozó tervezetek.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.emailThread.findUnique({
        where: { id },
        select: {
          id: true, subject: true, replyStatus: true, firstMessageAt: true, lastMessageAt: true,
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          emails: {
            orderBy: { sentAt: 'asc' },
            select: {
              id: true, direction: true, subject: true, textBody: true, sentAt: true,
              participants: { select: { type: true, emailAddress: true, displayName: true } },
            },
          },
          drafts: {
            where: { status: { in: ['draft', 'approved'] } },
            select: { id: true, subject: true, bodyText: true, status: true, source: true, createdAt: true },
          },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'A levélszál nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_company_emails',
    'Egy céghez tartozó levélszálak listája (a partner teljes levelezése a CRM-ben).',
    { companyId: z.string(), limit: z.number().int().min(1).max(100).optional() },
    async ({ companyId, limit }) => {
      const data = await prisma.emailThread.findMany({
        where: { companyId },
        orderBy: { lastMessageAt: 'desc' },
        take: limit ?? 50,
        select: {
          id: true, subject: true, replyStatus: true, lastMessageAt: true, messageCount: true,
          emails: { orderBy: { sentAt: 'desc' }, take: 1, select: { direction: true, snippet: true } },
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_email_draft',
    'Válasz-TERVEZET készítése egy levélszálhoz. FONTOS: ez NEM küld levelet — csak egy jóváhagyásra váró tervezetet hoz létre, amit az ember a Levelek fülön átnéz és jóváhagy. Erre való a proaktív előkészítés (pl. egy válaszra váró levélhez tervezet).',
    {
      threadId: z.string(),
      subject: z.string(),
      bodyText: z.string(),
    },
    async ({ threadId, subject, bodyText }) => {
      const thread = await prisma.emailThread.findUnique({
        where: { id: threadId },
        select: { id: true, companyId: true, contactId: true },
      })
      if (!thread) return { content: [{ type: 'text', text: 'A levélszál nem található.' }] }
      const draft = await prisma.emailDraft.create({
        data: {
          threadId, companyId: thread.companyId, contactId: thread.contactId,
          subject, bodyText, source: 'agent', status: 'draft', createdBy: 'agent',
        },
        select: { id: true },
      })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            { ok: true, draftId: draft.id, note: 'Tervezet létrehozva (NEM elküldve). Az ember a Levelek fülön hagyja jóvá.' },
            null, 2,
          ),
        }],
      }
    }
  )

  // ─── MEMINI BRAIN — DÖNTÉS, TANULSÁG, ÖTLET, NYITOTT ÜGY ─────────────────

  const brainLinks = {
    companyId: z.string().optional().describe('Kapcsolódó cég ID'),
    contactId: z.string().optional().describe('Kapcsolódó kapcsolattartó ID'),
    dealId:    z.string().optional().describe('Kapcsolódó deal ID'),
    orderId:   z.string().optional().describe('Kapcsolódó megrendelés ID'),
    taskId:    z.string().optional().describe('Kapcsolódó feladat ID'),
  }

  const brainMeta = {
    eventDate:  z.string().optional().describe('Mikor történt, YYYY-MM-DD (alapértelmezett: ma)'),
    importance: z.number().int().min(1).max(3).optional().describe('1 = alacsony, 2 = normál, 3 = magas'),
    confidence: z.enum(['certain', 'assumed']).optional()
      .describe('"assumed" = következtetés, nem megerősített tény. Bizonytalan állítást SOHA ne rögzíts "certain"-ként.'),
  }

  server.tool(
    'log_decision',
    'Meghozott döntés rögzítése az INDOKÁVAL együtt. A "reason" a legfontosabb mező: fél év múlva a döntésre emlékezni fogsz, az érvelésre nem. Használd, amikor a munka során döntés születik — árazás, partnerfeltétel, termékirány, stratégia.',
    {
      title:          z.string().describe('A döntés rövid megnevezése'),
      reason:         z.string().describe('MIÉRT született így — az érvelés, nem a döntés megismétlése'),
      description:    z.string().optional().describe('Részletek, kontextus'),
      alternatives:   z.string().optional().describe('Milyen alternatívákat vetettünk el és miért'),
      expectedResult: z.string().optional().describe('Mit várunk tőle'),
      participants:   z.string().optional().describe('Kik hozták / vettek részt benne'),
      reviewDate:     z.string().optional().describe('Mikor nézzük felül, YYYY-MM-DD'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'decision',
        title:   i.title,
        content: i.description || i.title,
        details: {
          reason:         i.reason,
          alternatives:   i.alternatives,
          expectedResult: i.expectedResult,
          participants:   i.participants,
        },
        dueDate: i.reviewDate,
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'log_learning',
    'Tanulság rögzítése: mi vált be, mi nem, és mit kezdjünk vele legközelebb. A "reusableRule" a lényeg — az újra alkalmazható szabály, amit egy hasonló helyzetben elő kell venni.',
    {
      title:        z.string().describe('A tanulság rövid megnevezése'),
      description:  z.string().describe('Mi történt, miből jött a felismerés'),
      reusableRule: z.string().describe('Az újra alkalmazható szabály — mit csináljunk legközelebb hasonló helyzetben'),
      worked:       z.string().optional().describe('Mi működött jól'),
      didntWork:    z.string().optional().describe('Mi nem működött'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'learning',
        title:   i.title,
        content: i.description,
        details: { reusableRule: i.reusableRule, worked: i.worked, didntWork: i.didntWork },
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'log_idea',
    'Ötlet rögzítése — külön kezelve a döntéstől és a feladattól. Az ötlet még nem elhatározás: van üzleti célja, kockázata és következő vizsgálati lépése.',
    {
      title:         z.string().describe('Az ötlet rövid megnevezése'),
      description:   z.string().describe('Miről szól'),
      businessValue: z.string().optional().describe('Milyen üzleti lehetőséget rejt'),
      risk:          z.string().optional().describe('Fő kockázat'),
      nextStep:      z.string().optional().describe('Következő vizsgálati lépés'),
      origin:        z.string().optional().describe('Honnan jött (partner, esemény, beszélgetés)'),
      status:        z.enum(['new', 'exploring', 'accepted', 'rejected', 'parked']).optional()
        .describe('Alapértelmezett: new'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'idea',
        title:   i.title,
        content: i.description,
        details: { businessValue: i.businessValue, risk: i.risk, nextStep: i.nextStep, origin: i.origin },
        status:  i.status,
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'log_open_loop',
    'Elvarratlan szál rögzítése: függőben lévő ügy, amire vissza kell térni. NEM ugyanaz, mint a feladat (create_task) — a feladat konkrét teendő határidővel, a nyitott ügy egy le nem zárt szál (válaszra várunk, ígéretet tettünk, döntés függőben).',
    {
      title:       z.string().describe('Mi a nyitott ügy'),
      nextAction:  z.string().describe('Mi a következő lépés'),
      description: z.string().optional().describe('Részletek, előzmény'),
      blocker:     z.string().optional().describe('Mi akadályozza / mire várunk'),
      dueDate:     z.string().optional().describe('Mikorra kell rendezni, YYYY-MM-DD'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'open_loop',
        title:   i.title,
        content: i.description || i.title,
        details: { nextAction: i.nextAction, blocker: i.blocker },
        dueDate: i.dueDate,
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'log_setback',
    'Kudarc rögzítése: ami félrement, nem jött össze, elutasításba vagy zsákutcába futott. NEM ugyanaz, mint a tanulság — a kudarc a nyers esemény (elvesztett partner, visszautasított ajánlat, félrement kampány, elrontott szállítás), a tanulság pedig a belőle leszűrt szabály. Előbb a kudarcot rögzítsd, a tanulságot külön (log_learning), amikor már látod. Így később megkérdezhető, hogy "hasonló helyzetben mi ment már félre".',
    {
      title:       z.string().describe('Mi ment félre — röviden'),
      description: z.string().describe('Mi történt pontosan'),
      cause:       z.string().optional().describe('Mi okozta, amennyire látjuk'),
      cost:        z.string().optional().describe('Mibe került — idő, pénz, elvesztett partner, jó hírnév'),
      differently: z.string().optional().describe('Mit csinálnánk másképp legközelebb'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'setback',
        title:   i.title,
        content: i.description,
        details: { cause: i.cause, cost: i.cost, differently: i.differently },
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'get_setbacks',
    'Kudarcok listája — mi ment félre. Az "unlearnedOnly" opcióval csak azok jönnek, amikből még NEM vontunk le tanulságot: ezeket érdemes átnézni, mert bennük van a fel nem használt tapasztalat. Ha egy kudarcból megszületett a tanulság, jelöld az update_brain_note-tal status: "lesson_drawn" értékre.',
    {
      companyId:     z.string().optional().describe('Csak ehhez a partnerhez tartozók'),
      unlearnedOnly: z.boolean().optional().describe('Csak amikből még nincs tanulság (status: recorded)'),
      limit:         z.number().int().min(1).max(100).optional().describe('Alapértelmezett: 30'),
    },
    async ({ companyId, unlearnedOnly, limit }) => {
      const data = await prisma.brainNote.findMany({
        where: {
          kind: 'setback',
          ...(companyId ? { companyId } : {}),
          ...(unlearnedOnly ? { status: 'recorded' } : {}),
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }],
        take: limit ?? 30,
      })
      if (data.length === 0) {
        return { content: [{ type: 'text', text: unlearnedOnly ? '✅ Nincs feldolgozatlan kudarc.' : 'Nincs rögzített kudarc.' }] }
      }
      const lines = data.map(n => {
        const d = n.details as { cause?: string; cost?: string; differently?: string }
        const who = n.company?.name ? ` | ${n.company.name}` : ''
        const when = n.eventDate ? ` | ${n.eventDate.toISOString().slice(0, 10)}` : ''
        const status = n.status === 'recorded' ? ' | ⚠️ még nincs belőle tanulság' : ' | tanulság levonva'
        return `🩹 ${n.title}${who}${when}${status}\n    ${n.content}`
          + (d.cause ? `\n    Ok: ${d.cause}` : '')
          + (d.cost ? `\n    Ára: ${d.cost}` : '')
          + (d.differently ? `\n    Másképp: ${d.differently}` : '')
          + `\n    ID: ${n.id}`
      })
      return { content: [{ type: 'text', text: `${data.length} kudarc:\n\n${lines.join('\n\n')}` }] }
    }
  )

  server.tool(
    'log_opportunity',
    'Lehetőség rögzítése: amit a HELYZET tár fel — nyíló ajtó, piaci rés, váratlan érdeklődés, egy elutasításból megnyíló nagyobb szegmens. NEM ötlet (azt MI találjuk ki) és NEM kudarc (bár gyakran egy kudarc párja: az elutasítás, ami jobb irányba terelt). Ha egy esemény egyszerre kudarc és lehetőség, rögzítsd MINDKETTŐT — a fájó oldalt log_setback-kel, a nyíló oldalt ezzel.',
    {
      title:       z.string().describe('Mi a lehetőség — röviden'),
      description: z.string().describe('Miből fakad, mit rejt'),
      value:       z.string().optional().describe('Mekkora üzleti lehetőség — nagyságrend, ha látható'),
      nextStep:    z.string().optional().describe('Mi a következő lépés a kiaknázásához'),
      origin:      z.string().optional().describe('Honnan jött (elutasítás, beszélgetés, piaci megfigyelés)'),
      ...brainLinks,
      ...brainMeta,
    },
    async (i) => {
      const note = await createBrainNote({
        kind:    'opportunity',
        title:   i.title,
        content: i.description,
        details: { value: i.value, nextStep: i.nextStep, origin: i.origin },
        companyId: i.companyId, contactId: i.contactId, dealId: i.dealId,
        orderId: i.orderId, taskId: i.taskId,
        eventDate: i.eventDate, importance: i.importance, confidence: i.confidence,
      })
      return { content: [{ type: 'text', text: describeBrainNote(note) }] }
    }
  )

  server.tool(
    'get_opportunities',
    'Feltárt lehetőségek listája. Az "openOnly" opcióval csak azok jönnek, amiket még nem ragadtunk meg és nem is szalasztottunk el (status: spotted vagy pursuing) — ezekkel érdemes foglalkozni. A státuszt az update_brain_note-tal léptetheted: spotted → pursuing → captured / missed.',
    {
      companyId: z.string().optional().describe('Csak ehhez a partnerhez tartozók'),
      openOnly:  z.boolean().optional().describe('Csak a még nyitott lehetőségek (spotted / pursuing)'),
      limit:     z.number().int().min(1).max(100).optional().describe('Alapértelmezett: 30'),
    },
    async ({ companyId, openOnly, limit }) => {
      const data = await prisma.brainNote.findMany({
        where: {
          kind: 'opportunity',
          ...(companyId ? { companyId } : {}),
          ...(openOnly ? { status: { in: ['spotted', 'pursuing'] } } : {}),
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }],
        take: limit ?? 30,
      })
      if (data.length === 0) {
        return { content: [{ type: 'text', text: openOnly ? 'Nincs nyitott lehetőség.' : 'Nincs rögzített lehetőség.' }] }
      }
      const lines = data.map(n => {
        const d = n.details as { value?: string; nextStep?: string; origin?: string }
        const who = n.company?.name ? ` | ${n.company.name}` : ''
        const status = BRAIN_STATUS_LABEL[n.status] ?? n.status
        return `🚀 ${n.title}${who} | ${status}\n    ${n.content}`
          + (d.value ? `\n    Érték: ${d.value}` : '')
          + (d.nextStep ? `\n    Következő lépés: ${d.nextStep}` : '')
          + (d.origin ? `\n    Eredet: ${d.origin}` : '')
          + `\n    ID: ${n.id}`
      })
      return { content: [{ type: 'text', text: `${data.length} lehetőség:\n\n${lines.join('\n\n')}` }] }
    }
  )

  server.tool(
    'reclassify_brain_note',
    'Brain-bejegyzés ÁTSOROLÁSA másik típusba — ha kiderül, hogy egy bejegyzés valójában más kategóriába tartozik (pl. amit kudarcként rögzítettünk, valójában lehetőség). A cím és a tartalom megmarad; a státusz az új típus alapértelmezettjére áll, a régi típus-specifikus details-mezők törlődnek (mert az új típushoz nem illenek). Ha csak a szöveget javítanád, arra az update_brain_note való.',
    {
      id:      z.string().describe('A bejegyzés ID-ja'),
      newKind: z.enum(BRAIN_KINDS).describe('Az új típus: decision | learning | idea | open_loop | setback | opportunity'),
    },
    async ({ id, newKind }) => {
      const existing = await prisma.brainNote.findUnique({ where: { id }, select: { kind: true, title: true } })
      if (!existing) return { content: [{ type: 'text', text: 'Bejegyzés nem található.' }] }
      if (existing.kind === newKind) {
        return { content: [{ type: 'text', text: `A bejegyzés már "${BRAIN_KIND_LABEL[newKind as BrainKind]}" típusú.` }] }
      }
      const note = await prisma.brainNote.update({
        where: { id },
        data: {
          kind: newKind,
          status: BRAIN_DEFAULT_STATUS[newKind as BrainKind],
          details: {}, // a régi típus mezői nem illenek az újhoz
          closedAt: null,
        },
        include: { company: { select: { name: true } } },
      })
      const from = BRAIN_KIND_LABEL[existing.kind as BrainKind] ?? existing.kind
      const to = BRAIN_KIND_LABEL[newKind as BrainKind]
      return { content: [{ type: 'text', text: `Átsorolva: "${note.title}" — ${from} → ${to}. A típus-specifikus mezőket (indok, ok, stb.) az update_brain_note-tal töltsd fel újra, ha kellenek.` }] }
    }
  )

  server.tool(
    'close_open_loop',
    'Nyitott ügy lezárása az eredmény rögzítésével.',
    {
      id:      z.string().describe('A nyitott ügy ID-ja'),
      outcome: z.string().describe('Mi lett a vége'),
    },
    async ({ id, outcome }) => {
      const existing = await prisma.brainNote.findUnique({ where: { id }, select: { kind: true, details: true, title: true } })
      if (!existing) return { content: [{ type: 'text', text: 'Bejegyzés nem található.' }] }
      const details = { ...(existing.details as Record<string, unknown>), outcome }
      await prisma.brainNote.update({
        where: { id },
        data: { status: 'closed', closedAt: new Date(), details },
      })
      return { content: [{ type: 'text', text: `Nyitott ügy lezárva: ${existing.title} — ${outcome}` }] }
    }
  )

  server.tool(
    'update_brain_note',
    'Meglévő Brain-bejegyzés módosítása (döntés, tanulság, ötlet, nyitott ügy). Csak a megadott mezők frissülnek. A "details" mezői összefésülődnek a meglévőkkel.',
    {
      id:         z.string().describe('Bejegyzés ID'),
      title:      z.string().optional(),
      content:    z.string().optional(),
      status:     z.string().optional().describe('Típusfüggő — döntés: active/superseded/reverted, ötlet: new/exploring/accepted/rejected/parked, nyitott ügy: open/closed, tanulság: active/archived'),
      importance: z.number().int().min(1).max(3).optional(),
      dueDate:    z.string().optional().describe('YYYY-MM-DD, vagy üres string a törléshez'),
      details:    z.record(z.string(), z.string()).optional().describe('Típusspecifikus mezők, pl. { "reason": "..." } — a meglévőkhöz fésülődik'),
    },
    async ({ id, title, content, status, importance, dueDate, details }) => {
      const existing = await prisma.brainNote.findUnique({ where: { id } })
      if (!existing) return { content: [{ type: 'text', text: 'Bejegyzés nem található.' }] }

      const allowed = BRAIN_STATUSES[existing.kind as BrainKind]
      if (status && allowed && !allowed.includes(status)) {
        return { content: [{ type: 'text', text: `Érvénytelen státusz "${status}" ehhez a típushoz (${existing.kind}). Érvényes: ${allowed.join(', ')}` }] }
      }

      const upd: Record<string, unknown> = {}
      if (title      !== undefined) upd.title      = title
      if (content    !== undefined) upd.content    = content
      if (status     !== undefined) upd.status     = status
      if (importance !== undefined) upd.importance = importance
      if (dueDate    !== undefined) upd.dueDate    = dueDate ? new Date(dueDate) : null
      if (details) upd.details = { ...(existing.details as Record<string, unknown>), ...details }
      if (status === 'closed') upd.closedAt = new Date()

      const note = await prisma.brainNote.update({
        where: { id }, data: upd,
        include: { company: { select: { name: true } } },
      })
      return { content: [{ type: 'text', text: `Frissítve — ${describeBrainNote(note)}` }] }
    }
  )

  server.tool(
    'list_brain_notes',
    'Brain-bejegyzések listázása szűrve: típus, cég, státusz szerint. Kereséshez használd inkább a search_knowledge tool-t.',
    {
      kind:      z.enum(BRAIN_KINDS).optional().describe('decision | learning | idea | open_loop'),
      companyId: z.string().optional(),
      contactId: z.string().optional(),
      status:    z.string().optional(),
      limit:     z.number().int().min(1).max(100).optional().describe('Alapértelmezett: 30'),
    },
    async ({ kind, companyId, contactId, status, limit }) => {
      const data = await prisma.brainNote.findMany({
        where: {
          ...(kind ? { kind } : {}),
          ...(companyId ? { companyId } : {}),
          ...(contactId ? { contactId } : {}),
          ...(status ? { status } : {}),
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ importance: 'desc' }, { eventDate: 'desc' }],
        take: limit ?? 30,
      })
      if (data.length === 0) return { content: [{ type: 'text', text: 'Nincs találat.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_open_loops',
    'Nyitott, le nem zárt ügyek — a lejárt határidejűek elöl. Beszélgetés elején érdemes megnézni: ezek a szálak várnak rendezésre.',
    {
      companyId:   z.string().optional().describe('Csak ehhez a céghez tartozók'),
      overdueOnly: z.boolean().optional().describe('Csak a lejárt határidejűek'),
    },
    async ({ companyId, overdueOnly }) => {
      const data = await prisma.brainNote.findMany({
        where: {
          kind:   'open_loop',
          status: 'open',
          ...(companyId ? { companyId } : {}),
          ...(overdueOnly ? { dueDate: { lt: new Date() } } : {}),
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      })
      if (data.length === 0) return { content: [{ type: 'text', text: '✅ Nincs nyitott ügy.' }] }

      const now = Date.now()
      const lines = data.map(n => {
        const details = n.details as { nextAction?: string; blocker?: string }
        const overdue = n.dueDate && n.dueDate.getTime() < now
        const due = n.dueDate ? ` | határidő: ${n.dueDate.toISOString().slice(0, 10)}${overdue ? ' ⚠️ LEJÁRT' : ''}` : ''
        const who = n.company?.name ? ` | ${n.company.name}` : ''
        const next = details.nextAction ? `\n    → ${details.nextAction}` : ''
        const blocker = details.blocker ? `\n    ⛔ ${details.blocker}` : ''
        return `• ${n.title}${who}${due}${next}${blocker}\n    ID: ${n.id}`
      })
      return { content: [{ type: 'text', text: `${data.length} nyitott ügy:\n\n${lines.join('\n')}` }] }
    }
  )

  server.tool(
    'search_knowledge',
    'Keresés a cég teljes tudásában: Brain-bejegyzések (döntések és indokaik, tanulságok, ötletek, nyitott ügyek), memóriák, aktivitások és levelek. Kulcsszóra és kifejezésre is keres: idézőjelben pontos kifejezés ("éves vállalás"), mínusszal kizárás (-minta), "or" a vagy-kapcsolathoz. Ezzel válaszolhatók az olyan kérdések, mint "miért vezettük be ezt az ármodellt?" vagy "mit ígértünk ennek a partnernek?".',
    {
      query:     z.string().optional().describe('Keresőkifejezés. Elhagyva: szűrt listázás időrendben.'),
      scopes:    z.array(z.enum(['brain', 'memory', 'activity', 'email'])).optional()
        .describe('Hol keressen (alapértelmezett: mindenhol)'),
      kind:      z.string().optional().describe('Szűkítés típusra — brain: decision/learning/idea/open_loop, activity: call/email/meeting/…, email: inbound/outbound'),
      companyId: z.string().optional(),
      contactId: z.string().optional(),
      status:    z.string().optional().describe('Brain-bejegyzés státusza'),
      from:      z.string().optional().describe('Ettől a naptól, YYYY-MM-DD'),
      to:        z.string().optional().describe('Eddig a napig, YYYY-MM-DD'),
      limit:     z.number().int().min(1).max(100).optional().describe('Alapértelmezett: 25'),
    },
    async (o) => {
      const hits = await searchKnowledge({
        ...o,
        scopes: o.scopes as KnowledgeScope[] | undefined,
      })
      if (hits.length === 0) {
        return { content: [{ type: 'text', text: `Nincs találat${o.query ? ` erre: "${o.query}"` : ''}.` }] }
      }
      const SCOPE_LABEL: Record<string, string> = {
        brain: 'Tudás', memory: 'Memória', activity: 'Aktivitás', email: 'Levél',
      }
      const lines = hits.map(h => {
        const kind = BRAIN_KIND_LABEL[h.kind as BrainKind] ?? h.kind
        const date = h.date ? h.date.slice(0, 10) : '—'
        const who = h.companyName ? ` | ${h.companyName}` : ''
        const status = h.status ? ` | ${BRAIN_STATUS_LABEL[h.status] ?? h.status}` : ''
        // Memóriánál a cím a tartalom eleje — ne írjuk ki kétszer.
        const title = h.scope === 'memory' ? '' : `\n  ${h.title}`
        return `[${SCOPE_LABEL[h.scope] ?? h.scope}${kind ? ` / ${kind}` : ''}] ${date}${who}${status}${title}\n  ${h.snippet}\n  ID: ${h.id}`
      })
      return { content: [{ type: 'text', text: `${hits.length} találat:\n\n${lines.join('\n\n')}` }] }
    }
  )

  // ─── NAPI NAPLÓ — A NAP RÖVID TÁVÚ MEMÓRIÁJA ─────────────────────────────

  server.tool(
    'get_daily_facts',
    'A nap TÉNYEI a CRM-ből, determinisztikusan (nem AI-tól): új és módosult rendelések, számlák, ajánlatok, mozdult dealek, elvégzett/új/lejárt feladatok, aktivitások, beérkezett levelek és válaszra váró szálak, készletmozgás, új partnerek, plusz a ma már rögzített tudás és a nyitott ügyek. Ezt hívd meg ELŐSZÖR minden napi futásnál, és csak erre támaszkodj — számot, rendelésszámot, dátumot soha ne találj ki. A "since" megadásával csak a legutóbbi mentésed óta történtek jönnek (a napi napló lastSavedAt mezője adja).',
    {
      day:   z.string().optional().describe('YYYY-MM-DD (helyi nap), alapértelmezett: ma'),
      since: z.string().optional().describe('ISO időbélyeg — csak az ez utáni események. Napközi állapotmentésnél a napló lastSavedAt értéke.'),
    },
    async ({ day, since }) => {
      if (day && !isValidDay(day)) {
        return { content: [{ type: 'text', text: `Érvénytelen dátum: "${day}". Formátum: YYYY-MM-DD` }] }
      }
      const facts = await collectDailyFacts({ day, since })
      const hint = facts.kommunikacio.levelSzinkronAktiv
        ? ''
        : '\n\nMEGJEGYZÉS: a CRM levélszinkronja nem adott vissza semmit erre az időszakra. Ha van saját postafiók-hozzáférésed, onnan dolgozz, és a naplóba emailSource: "agent" jelöléssel mentsd.'
      return { content: [{ type: 'text', text: `${JSON.stringify(facts, null, 2)}${hint}` }] }
    }
  )

  server.tool(
    'save_daily_journal',
    'A napi napló írása. A nap során többször is hívható — a szöveg HOZZÁFŰZŐDIK a meglévőhöz, nem írja felül (a 16:00-s mentés nem törli a 12:00-s munkáját). Egy nap egy rekord, ismételt futás nem duplikál. A záró futás a closeDay: true-val zárja le a napot. Levelek szövegét NE mentsd — csak ki írt, miről, és mi a teendő.',
    {
      day:           z.string().optional().describe('YYYY-MM-DD, alapértelmezett: ma'),
      narrative:     z.string().optional().describe('Mi történt — a nap krónikája. Ha nem történt semmi, két sor is elég; ne tölts vattával.'),
      narrativeMode: z.enum(['append', 'replace']).optional().describe('append (alapértelmezett) = hozzáfűz, replace = felülírja az egészet'),
      emailDigest: z.array(z.object({
        from:      z.string().optional().describe('Ki írt'),
        subject:   z.string().optional(),
        gist:      z.string().optional().describe('Miről szól — 1-2 mondat, NEM a levél szövege'),
        action:    z.string().optional().describe('Mi a teendő belőle'),
        companyId: z.string().optional().describe('Melyik partnerhez tartozik'),
      })).optional().describe('A nap érdemi levelei kivonatolva'),
      emailSource: z.enum(['agent', 'crm']).optional().describe('A levelek a saját postafiókodból (agent) vagy a CRM szinkronjából (crm) jöttek'),
      priorities:  z.array(z.string()).optional().describe('A következő nap fő fókuszai (max 3) — a záró futásnál'),
      facts:       z.record(z.string(), z.unknown()).optional().describe('A get_daily_facts pillanatképe, ha el akarod tárolni a naplóval'),
      checkpointLabel: z.string().optional().describe('Ennek a futásnak a neve, pl. "12:00 állapotmentés"'),
      checkpointNote:  z.string().optional().describe('Rövid megjegyzés a futásról'),
      closeDay:    z.boolean().optional().describe('true = a nap lezárása (a 20:30-as futásnál)'),
    },
    async (i) => {
      if (i.day && !isValidDay(i.day)) {
        return { content: [{ type: 'text', text: `Érvénytelen dátum: "${i.day}". Formátum: YYYY-MM-DD` }] }
      }
      const journal = await saveJournal({
        day:           i.day,
        narrative:     i.narrative,
        narrativeMode: i.narrativeMode,
        emailDigest:   i.emailDigest as EmailDigestItem[] | undefined,
        emailSource:   i.emailSource,
        priorities:    i.priorities,
        facts:         i.facts,
        checkpoint:    i.checkpointLabel ? { label: i.checkpointLabel, note: i.checkpointNote } : undefined,
        closeDay:      i.closeDay,
      })
      const digest = (journal.emailDigest as unknown[]).length
      const marks = (journal.checkpoints as unknown[]).length
      const state = journal.closedAt ? 'LEZÁRVA' : 'nyitott'
      return {
        content: [{
          type: 'text',
          text: `Napló mentve — ${i.day ?? localDay()} (${state})\n`
              + `Mentések száma: ${marks} | Levélkivonatok: ${digest}\n`
              + `Következő futásnál használd: since = "${journal.lastSavedAt?.toISOString()}"`,
        }],
      }
    }
  )

  server.tool(
    'get_daily_journal',
    'Napi napló olvasása — egy napra vagy időszakra. A reggeli futásnál ezzel kérd le a tegnapi napot, hogy tudd, hol tartottunk. A visszaadott lastSavedAt a napközi állapotmentések vízjele: azt add át a get_daily_facts "since" paraméterének.',
    {
      day:   z.string().optional().describe('YYYY-MM-DD — egyetlen nap'),
      from:  z.string().optional().describe('Időszak kezdete YYYY-MM-DD'),
      to:    z.string().optional().describe('Időszak vége YYYY-MM-DD'),
      limit: z.number().int().min(1).max(120).optional().describe('Alapértelmezett: 30'),
    },
    async ({ day, from, to, limit }) => {
      if (day) {
        if (!isValidDay(day)) return { content: [{ type: 'text', text: `Érvénytelen dátum: "${day}".` }] }
        const j = await getJournal(day)
        if (!j) return { content: [{ type: 'text', text: `Nincs napló ${day} napra.` }] }
        return { content: [{ type: 'text', text: JSON.stringify(j, null, 2) }] }
      }
      const rows = await listJournals({ from, to, limit })
      if (rows.length === 0) return { content: [{ type: 'text', text: 'Nincs napló ebben az időszakban.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  server.tool(
    'save_executive_summary',
    'Vezetői összefoglaló eltárolása, hogy ne csak a beszélgetésben létezzen — a CRM Arthur-jelentések oldalán jelenik meg. A reggeli futás ezzel menti a napi helyzetképet.',
    {
      summary: z.string().describe('Az összefoglaló szövege'),
      title:   z.string().optional().describe('Cím, alapértelmezett: "Vezetői összefoglaló – <dátum>"'),
      type:    z.enum(['daily', 'weekly', 'monthly', 'adhoc']).optional().describe('Alapértelmezett: daily'),
      drafts:  z.array(z.object({
        to:      z.string().describe('Címzett / cég'),
        subject: z.string(),
        body:    z.string(),
      })).optional().describe('Javasolt e-mail-piszkozatok'),
    },
    async ({ summary, title, type, drafts }) => {
      const today = localDay()
      const report = await prisma.arthurReport.create({
        data: {
          type:    type ?? 'daily',
          title:   title ?? `Vezetői összefoglaló – ${today}`,
          summary,
          drafts:  (drafts ?? []) as object[],
        },
      })
      return { content: [{ type: 'text', text: `Összefoglaló mentve: ${report.title} (ID: ${report.id})` }] }
    }
  )

  return server
}

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.MCP_SECRET
  // ZÁRVA BUKÁS: ha nincs kulcs beállítva, TAGADUNK — nem nyitunk meg mindent.
  // Korábban a hiányzó kulcs mindenkit beengedett; egy elgépelt vagy törölt
  // Vercel-env így teljesen nyitottá tette a 120+ tool-os felületet.
  if (!secret) {
    return unauthorized('MCP hozzáférés letiltva: a szerveren nincs MCP_SECRET beállítva.')
  }
  // Kulcs elfogadása fejlécből (x-api-key / Authorization: Bearer) VAGY query-ből (?key=).
  // A query-paraméter azért kell, mert egyes MCP-kliensek (pl. ChatGPT-app connector)
  // nem küldenek egyedi fejlécet.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const key = request.headers.get('x-api-key') || bearer || request.nextUrl.searchParams.get('key')
  if (!key || key.length !== secret.length || !timingSafeEqual(key, secret)) {
    return unauthorized('Unauthorized')
  }
  return null
}

/** Konstans idejű összehasonlítás — ne áruljuk el a kulcsot a válaszidőből. */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}
