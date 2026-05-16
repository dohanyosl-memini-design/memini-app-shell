import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Te a Memini Design CRM rendszer AI asszisztense vagy.
A felhasználó Laszlo Arpad Dohanyos e.U. vállalkozó (Ulm, Németország).
Mindig magyarul válaszolj, röviden és pontosan.
Ha adatot kérsz le az adatbázisból, összefoglalva mutasd be — ne JSON-t írj ki, hanem érthető szöveget.
Ha műveletet hajtasz végre (pl. státusz módosítás), erősítsd meg röviden.
Dátumokat dd.MM.yyyy formátumban mutasd. Összegeket 1.234,56 € formátumban.`

const tools: Anthropic.Tool[] = [
  {
    name: 'list_invoices',
    description: 'Számlák listázása. Szűrhető státusz és lejárt fizetés szerint.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'sent', 'paid', 'cancelled'], description: 'Státusz szűrő' },
        overdue: { type: 'boolean', description: 'Csak lejárt, kifizetetlen számlák' },
      },
    },
  },
  {
    name: 'get_invoice',
    description: 'Egy számla részletes adatainak lekérése.',
    input_schema: {
      type: 'object' as const,
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'update_invoice_status',
    description: 'Számla státuszának módosítása.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['open', 'sent', 'paid', 'cancelled'] },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'list_delivery_notes',
    description: 'Szállítólevelek listázása.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['draft', 'sent', 'delivered'] },
      },
    },
  },
  {
    name: 'list_contacts',
    description: 'Ügyfelek / kapcsolatok listázása.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Keresés névre vagy emailre' },
      },
    },
  },
  {
    name: 'list_companies',
    description: 'Cégek listázása.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string' },
      },
    },
  },
  {
    name: 'list_products',
    description: 'Termékek listázása raktárkészlettel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string' },
      },
    },
  },
  {
    name: 'list_orders',
    description: 'Megrendelések listázása.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Dashboard összesítő: nyitott számlák, havi bevétel, raktárkészlet.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === 'list_invoices') {
      const where: Record<string, unknown> = {}
      if (input.status) where.status = input.status
      if (input.overdue) {
        where.dueDate = { lt: new Date() }
        where.status = { in: ['open', 'sent'] }
      }
      const data = await prisma.invoice.findMany({
        where,
        include: { company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      })
      return JSON.stringify(data)
    }

    if (name === 'get_invoice') {
      const data = await prisma.invoice.findUnique({
        where: { id: input.id as string },
        include: { company: true, contact: true, items: true },
      })
      return JSON.stringify(data)
    }

    if (name === 'update_invoice_status') {
      const data = await prisma.invoice.update({
        where: { id: input.id as string },
        data: {
          status: input.status as string,
          ...(input.status === 'paid' ? { paidAt: new Date() } : {}),
        },
      })
      return JSON.stringify({ ok: true, number: data.number, status: data.status })
    }

    if (name === 'list_delivery_notes') {
      const data = await prisma.deliveryNote.findMany({
        where: input.status ? { status: input.status as string } : {},
        include: { company: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      })
      return JSON.stringify(data)
    }

    if (name === 'list_contacts') {
      const data = await prisma.contact.findMany({
        where: input.search ? {
          OR: [
            { firstName: { contains: input.search as string } },
            { lastName: { contains: input.search as string } },
            { email: { contains: input.search as string } },
          ],
        } : {},
        include: { company: { select: { name: true } } },
        take: 20,
      })
      return JSON.stringify(data)
    }

    if (name === 'list_companies') {
      const data = await prisma.company.findMany({
        where: input.search ? {
          OR: [
            { name: { contains: input.search as string } },
            { city: { contains: input.search as string } },
          ],
        } : {},
        take: 20,
        orderBy: { name: 'asc' },
      })
      return JSON.stringify(data)
    }

    if (name === 'list_products') {
      const data = await prisma.product.findMany({
        where: input.search ? {
          OR: [
            { name: { contains: input.search as string } },
            { sku: { contains: input.search as string } },
          ],
        } : {},
        take: 30,
        orderBy: { name: 'asc' },
      })
      return JSON.stringify(data)
    }

    if (name === 'list_orders') {
      const data = await prisma.order.findMany({
        where: {
          ...(input.companyId ? { companyId: input.companyId as string } : {}),
          ...(input.status ? { status: input.status as string } : {}),
        },
        include: {
          company: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return JSON.stringify(data)
    }

    if (name === 'get_stats') {
      const [open, paidMonth, stock] = await Promise.all([
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
      return JSON.stringify({
        openInvoices: { count: open._count, total: open._sum.total },
        paidThisMonth: { count: paidMonth._count, total: paidMonth._sum.total },
        products: { count: stock._count, totalStock: stock._sum.stock },
      })
    }

    return 'Ismeretlen eszköz'
  } catch (e) {
    return `Hiba: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    const conversation: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })
    )

    let response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      tools,
      messages: conversation,
    })

    let iterations = 0
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        }
      }

      conversation.push({ role: 'assistant', content: response.content })
      conversation.push({ role: 'user', content: toolResults })

      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM,
        tools,
        messages: conversation,
      })
    }

    const text = response.content.find(b => b.type === 'text')
    return NextResponse.json({ reply: text?.type === 'text' ? text.text : 'Nincs válasz.' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Chat API hiba:', msg)
    return NextResponse.json({ reply: `Hiba: ${msg}` }, { status: 500 })
  }
}
