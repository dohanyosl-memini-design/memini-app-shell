#!/usr/bin/env node
/**
 * Memini CRM – MCP szerver
 *
 * Indítás: npx tsx mcp/server.ts
 * Env:     CRM_BASE_URL (alapértelmezett: http://localhost:3000)
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "memini-crm": {
 *       "command": "npx",
 *       "args": ["tsx", "/TELJES/UT/memini-app-shell/mcp/server.ts"],
 *       "env": { "CRM_BASE_URL": "https://meminidesign.vercel.app" }
 *     }
 *   }
 * }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL = process.env.CRM_BASE_URL ?? 'http://localhost:3000'

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CRM API hiba ${res.status}: ${text}`)
  }
  return res.json()
}

const server = new McpServer({ name: 'memini-crm', version: '1.0.0' })

// ─── SZÁMLÁK ───────────────────────────────────────────────────────────────

server.tool(
  'list_invoices',
  'Számlák listázása. Szűrhető státusz és lejárt alapján.',
  {
    status: z.enum(['open', 'sent', 'paid', 'cancelled', 'storno']).optional()
      .describe('Szűrés státuszra'),
    overdue: z.boolean().optional()
      .describe('Csak lejárt, kifizetetlen számlák'),
  },
  async ({ status, overdue }) => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (overdue) p.set('overdue', 'true')
    const data = await api(`/api/invoices?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_invoice',
  'Egy számla teljes adatainak lekérése azonosító alapján.',
  { id: z.string().describe('Számla ID') },
  async ({ id }) => {
    const data = await api(`/api/invoices/${id}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_invoice',
  'Új számla kiállítása tételekkel.',
  {
    companyId:      z.string().optional().describe('Cég ID'),
    contactId:      z.string().optional().describe('Kapcsolat ID'),
    date:           z.string().optional().describe('Számla dátuma (YYYY-MM-DD), alapértelmezett: ma'),
    dueDate:        z.string().describe('Fizetési határidő (YYYY-MM-DD)'),
    deliveryInfo:   z.string().optional().describe('Szállítási dátum / info'),
    notes:          z.string().optional().describe('Megjegyzés'),
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
    const data = await api('/api/invoices', { method: 'POST', body: JSON.stringify(body) })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'update_invoice_status',
  'Számla státuszának módosítása (pl. open → sent → paid).',
  {
    id:     z.string().describe('Számla ID'),
    status: z.enum(['open', 'sent', 'paid', 'cancelled']).describe('Új státusz'),
  },
  async ({ id, status }) => {
    const data = await api(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── SZÁLLÍTÓLEVELEK ───────────────────────────────────────────────────────

server.tool(
  'list_delivery_notes',
  'Szállítólevelek listázása.',
  {
    status: z.enum(['draft', 'sent', 'delivered']).optional()
      .describe('Szűrés státuszra'),
  },
  async ({ status }) => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    const data = await api(`/api/delivery-notes?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_delivery_note',
  'Egy szállítólevél lekérése azonosító alapján.',
  { id: z.string() },
  async ({ id }) => {
    const data = await api(`/api/delivery-notes/${id}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_delivery_note',
  'Új szállítólevél kiállítása.',
  {
    companyId:      z.string().optional(),
    contactId:      z.string().optional(),
    date:           z.string().optional().describe('YYYY-MM-DD'),
    deliveryInfo:   z.string().optional(),
    notes:          z.string().optional(),
    billingName:    z.string().optional(),
    billingAddress: z.string().optional(),
    billingZip:     z.string().optional(),
    billingCity:    z.string().optional(),
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
    const data = await api('/api/delivery-notes', { method: 'POST', body: JSON.stringify(body) })
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
    const data = await api(`/api/delivery-notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── KAPCSOLATOK ───────────────────────────────────────────────────────────

server.tool(
  'list_contacts',
  'Kapcsolatok (ügyfelek) listázása.',
  {
    search:  z.string().optional().describe('Keresés névre, emailre'),
    crmOnly: z.boolean().optional().describe('Csak CRM ügyfelek (pipeline nélkül)'),
  },
  async ({ search, crmOnly }) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (crmOnly) p.set('crmOnly', 'true')
    const data = await api(`/api/contacts?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_contact',
  'Egy kapcsolat lekérése azonosító alapján.',
  { id: z.string() },
  async ({ id }) => {
    const data = await api(`/api/contacts/${id}`)
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
    const data = await api('/api/contacts', { method: 'POST', body: JSON.stringify(body) })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── CÉGEK ─────────────────────────────────────────────────────────────────

server.tool(
  'list_companies',
  'Cégek listázása.',
  {
    search:      z.string().optional(),
    country:     z.string().optional(),
    partnerType: z.string().optional(),
  },
  async ({ search, country, partnerType }) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (country) p.set('country', country)
    if (partnerType) p.set('partnerType', partnerType)
    const data = await api(`/api/companies?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_company',
  'Egy cég lekérése azonosító alapján.',
  { id: z.string() },
  async ({ id }) => {
    const data = await api(`/api/companies/${id}`)
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
    const data = await api('/api/companies', { method: 'POST', body: JSON.stringify(body) })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── TERMÉKEK ──────────────────────────────────────────────────────────────

server.tool(
  'list_products',
  'Termékek listázása. Szűrhető hordozóra (material).',
  {
    search:   z.string().optional(),
    material: z.string().optional().describe('Hordozó kódja (pl. ko_grafitoptik_normal)'),
  },
  async ({ search, material }) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (material) p.set('material', material)
    const data = await api(`/api/products?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── HORDOZÓK ──────────────────────────────────────────────────────────────

server.tool(
  'list_carriers',
  'Hordozók (anyagok) listázása kódokkal és német nevekkel.',
  {},
  async () => {
    const data = await api('/api/carriers')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── MEGRENDELÉSEK ─────────────────────────────────────────────────────────

server.tool(
  'list_orders',
  'Megrendelések listázása.',
  {
    companyId: z.string().optional(),
    contactId: z.string().optional(),
    status:    z.string().optional(),
  },
  async ({ companyId, contactId, status }) => {
    const p = new URLSearchParams()
    if (companyId) p.set('companyId', companyId)
    if (contactId) p.set('contactId', contactId)
    if (status) p.set('status', status)
    const data = await api(`/api/orders?${p}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_order',
  'Egy megrendelés lekérése azonosító alapján.',
  { id: z.string() },
  async ({ id }) => {
    const data = await api(`/api/orders/${id}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_order',
  'Új megrendelés létrehozása.',
  {
    companyId:    z.string().optional(),
    contactId:    z.string().optional(),
    deliveryDate: z.string().optional().describe('YYYY-MM-DD'),
    notes:        z.string().optional(),
    items: z.array(z.object({
      productId:   z.string(),
      quantity:    z.number().positive(),
      unitPrice:   z.number(),
      vatRate:     z.number().default(19),
      description: z.string().optional(),
    })).min(1),
  },
  async (body) => {
    const data = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── ÁRLISTA & STATISZTIKA ─────────────────────────────────────────────────

server.tool(
  'get_pricelist',
  'Teljes árlista lekérése hordozónként, mennyiségi szintekkel.',
  {},
  async () => {
    const data = await api('/api/pricelist')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_stats',
  'Dashboard statisztikák: bevétel, nyitott számlák, raktárkészlet összesítő.',
  {},
  async () => {
    const data = await api('/api/stats')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ─── Indítás ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
