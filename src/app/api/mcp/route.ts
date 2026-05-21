import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function buildServer() {
  const server = new McpServer({ name: 'memini-crm', version: '1.0.0' })

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
    'Új számla kiállítása tételekkel.',
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
          status:         'open',
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
    'Számla státuszának módosítása (pl. open → sent → paid).',
    {
      id:     z.string(),
      status: z.enum(['open', 'sent', 'paid', 'cancelled']),
    },
    async ({ id, status }) => {
      const data = await prisma.invoice.update({
        where: { id },
        data: { status, ...(status === 'paid' ? { paidAt: new Date() } : {}) },
      })
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
    'Megrendelések listázása.',
    {
      companyId: z.string().optional(),
      contactId: z.string().optional(),
      status:    z.string().optional(),
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
