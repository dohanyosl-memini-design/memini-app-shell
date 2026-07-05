import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMnbRate } from '@/lib/mnb'
import { DEAL_STAGE_KEYS, LEGACY_STAGE_KEYS, normalizeStage } from '@/lib/dealStages'

export const dynamic = 'force-dynamic'

// Deal-szakasz enum az MCP tool-okhoz: új tölcsér-kulcsok + régi aliasok
// (a régi kulcsokat a handler normalizeStage-dzsel konvertálja — visszafelé kompatibilis).
const dealStageEnum = z.enum([...DEAL_STAGE_KEYS, ...LEGACY_STAGE_KEYS] as [string, ...string[]])

function buildServer() {
  const server = new McpServer({ name: 'memini-crm', version: '1.0.1' })

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
        include: { company: true, invoices: { take: 5, orderBy: { date: 'desc' } } },
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
    'Cégek listázása.',
    {
      search:      z.string().optional(),
      country:     z.string().optional(),
      partnerType: z.string().optional(),
    },
    async ({ search, country, partnerType }) => {
      const data = await prisma.company.findMany({
        where: {
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
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Cég nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_company',
    'Új cég létrehozása.',
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
    },
    async (body) => {
      const data = await prisma.company.create({ data: body })
      return { content: [{ type: 'text', text: `Cég létrehozva: ${data.name} (${data.id})` }] }
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

      const year = new Date().getFullYear()
      const prefix = `MR-${year}-`
      const last = await prisma.order.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: 'desc' },
      })
      const next = last ? parseInt(last.number.split('-')[2]) + 1 : 1
      const number = `${prefix}${String(next).padStart(3, '0')}`

      const order = await prisma.order.create({
        data: {
          number,
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
    'Feladatok listázása. Szűrhető státusz, prioritás, kapcsolat és cég alapján.',
    {
      status:    z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
      priority:  z.enum(['low', 'medium', 'high']).optional(),
      contactId: z.string().optional(),
      companyId: z.string().optional(),
    },
    async ({ status, priority, contactId, companyId }) => {
      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (priority) where.priority = priority
      if (contactId) where.contactId = contactId
      if (companyId) where.companyId = companyId
      const data = await prisma.task.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          subtasks: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_task',
    'Egy feladat teljes részleteinek lekérése.',
    { id: z.string() },
    async ({ id }) => {
      const data = await prisma.task.findUnique({
        where: { id },
        include: {
          contact: true,
          company: true,
          deal: true,
          assignee: { select: { id: true, name: true } },
          subtasks: { orderBy: { createdAt: 'asc' } },
        },
      })
      if (!data) return { content: [{ type: 'text', text: 'Feladat nem található.' }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'create_task',
    'Új feladat létrehozása. A dueDate YYYY-MM-DD formátumban adható meg.',
    {
      title:       z.string(),
      description: z.string().optional(),
      dueDate:     z.string().optional().describe('Határidő, YYYY-MM-DD formátum'),
      priority:    z.enum(['low', 'medium', 'high']).optional(),
      status:      z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
      contactId:   z.string().optional(),
      companyId:   z.string().optional(),
      dealId:      z.string().optional(),
      subtasks:    z.array(z.string()).optional().describe('Részfeladatok listája (szövegek tömbje)'),
    },
    async (body) => {
      const data = await prisma.task.create({
        data: {
          title:       body.title,
          description: body.description || null,
          dueDate:     body.dueDate ? new Date(body.dueDate) : null,
          priority:    body.priority || 'medium',
          status:      body.status || 'pending',
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
          subtasks: true,
        },
      })
      return { content: [{ type: 'text', text: `Feladat létrehozva: ${data.title} (${data.id})` }] }
    }
  )

  server.tool(
    'update_task',
    'Feladat módosítása: státusz, prioritás, határidő, leírás.',
    {
      id:          z.string(),
      status:      z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
      priority:    z.enum(['low', 'medium', 'high']).optional(),
      title:       z.string().optional(),
      description: z.string().optional(),
      dueDate:     z.string().optional().describe('Új határidő YYYY-MM-DD, vagy null a törléshez'),
    },
    async ({ id, status, priority, title, description, dueDate }) => {
      const data = await prisma.task.update({
        where: { id },
        data: {
          ...(status      ? { status }      : {}),
          ...(priority    ? { priority }    : {}),
          ...(title       ? { title }       : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        },
      })
      return { content: [{ type: 'text', text: `Feladat frissítve: ${data.title} → ${data.status}` }] }
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

  return server
}

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.MCP_SECRET
  if (!secret) return null
  const key = request.headers.get('x-api-key')
  if (key !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
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
