// Read-only export az éles (vagy staging) adatbázisból a replay-backtesthez.
//
// KIZÁRÓLAG SELECT-eket futtat — semmilyen írási művelet nincs benne, az
// agentnek nem kell és nem is kap írási jogot. Az eredmény egy önálló JSON
// snapshot, amin a replay offline, reprodukálhatóan, többször futtatható.
//
// Futtatás (ahol a DATABASE_URL elérhető, pl. lokálisan vagy Vercel env-vel):
//   npx tsx scripts/backtest/export.ts --out exports/memini-export.json --anonymize
//
// --anonymize: cég- és személynevek pszeudonimizálva (Partner-01, Kontakt-01),
// e-mail/telefon/cím elhagyva; a feloldó térkép külön fájlba kerül
// (<out>.mapping.json), amit NE adj oda a modellnek.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaClient } from '@prisma/client'
import type { ExportSnapshot } from './types'

const argOf = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}
const anonymize = process.argv.includes('--anonymize')
const outFile = argOf('out') ?? `exports/memini-export-${new Date().toISOString().slice(0, 10)}.json`

async function main() {
  const prisma = new PrismaClient()
  console.log(`Export indul (read-only)${anonymize ? ' — anonimizálva' : ''}…`)

  const [
    companies, contacts, deals, tasks, taskEvents, activities, invoices,
    orders, quotes, deliveryNotes, memoryEntries, stockMovements, expenses,
    purchaseOrders,
  ] = await Promise.all([
    prisma.company.findMany({ select: {
      id: true, name: true, partnerType: true, classification: true, city: true,
      region: true, country: true, channel: true, notes: true, createdAt: true,
    } }),
    prisma.contact.findMany({ select: {
      id: true, firstName: true, lastName: true, status: true, companyId: true,
      notes: true, createdAt: true,
    } }),
    prisma.deal.findMany({ select: {
      id: true, title: true, value: true, stage: true, closeDate: true,
      notes: true, companyId: true, createdAt: true, updatedAt: true,
    } }),
    prisma.task.findMany({ select: {
      id: true, title: true, description: true, status: true, waitingFor: true,
      companyId: true, createdAt: true,
    } }),
    prisma.taskEvent.findMany({ select: {
      id: true, actor: true, action: true, field: true, before: true, after: true,
      createdAt: true, task: { select: { title: true, companyId: true } },
    } }),
    prisma.activity.findMany({ select: {
      id: true, type: true, subject: true, description: true, outcome: true,
      activityDate: true, companyId: true, contactId: true, createdAt: true,
    } }),
    prisma.invoice.findMany({ select: {
      id: true, number: true, date: true, dueDate: true, total: true,
      paidAt: true, companyId: true,
    } }),
    prisma.order.findMany({ select: {
      id: true, number: true, date: true, total: true, notes: true,
      internalNotes: true, deliveryDate: true, companyId: true,
      items: { select: { description: true, quantity: true } },
    } }),
    prisma.quote.findMany({ select: {
      id: true, number: true, date: true, total: true, notes: true, companyId: true,
    } }),
    prisma.deliveryNote.findMany({ select: {
      id: true, number: true, date: true, total: true, notes: true, companyId: true,
    } }),
    prisma.memoryEntry.findMany({ select: {
      id: true, content: true, date: true, source: true, companyId: true,
      createdAt: true, type: { select: { label: true } },
    } }),
    prisma.stockMovement.findMany({ select: {
      id: true, type: true, quantity: true, note: true, createdAt: true,
      product: { select: { name: true } },
    } }),
    prisma.expense.findMany({ select: {
      id: true, date: true, vendor: true, description: true, amount: true,
      totalAmount: true, currency: true,
    } }),
    prisma.purchaseOrder.findMany({ select: {
      id: true, number: true, notes: true, orderedAt: true, createdAt: true,
      supplier: { select: { name: true } },
    } }),
  ])
  await prisma.$disconnect()

  // Anonimizálás: determinisztikus pszeudonimek + feloldó térkép külön fájlban.
  const companyAlias = new Map<string, string>()
  const contactAlias = new Map<string, string>()
  if (anonymize) {
    companies.forEach((c, i) => companyAlias.set(c.id, `Partner-${String(i + 1).padStart(2, '0')}`))
    contacts.forEach((c, i) => contactAlias.set(c.id, `Kontakt-${String(i + 1).padStart(2, '0')}`))
  }
  const cname = (id: string, real: string) => anonymize ? companyAlias.get(id)! : real
  // Szabad szövegben (notes, memória) a cégneveket is lecseréljük.
  const scrub = (text: string | null): string | null => {
    if (!text || !anonymize) return text
    let out = text
    for (const c of companies) {
      if (c.name.length >= 4) out = out.split(c.name).join(companyAlias.get(c.id)!)
    }
    for (const c of contacts) {
      const full = `${c.firstName} ${c.lastName}`.trim()
      if (full.length >= 5) out = out.split(full).join(contactAlias.get(c.id)!)
    }
    return out
  }

  const iso = (d: Date | null) => d ? d.toISOString() : null

  const snapshot: ExportSnapshot = {
    exportedAt: new Date().toISOString(),
    anonymized: anonymize,
    counts: {},
    companies: companies.map(c => ({
      id: c.id, name: cname(c.id, c.name), partnerType: c.partnerType,
      classification: c.classification, city: c.city, region: c.region,
      country: c.country, channel: c.channel, notes: scrub(c.notes),
      createdAt: c.createdAt.toISOString(),
    })),
    contacts: contacts.map(c => ({
      id: c.id,
      name: anonymize ? contactAlias.get(c.id)! : `${c.firstName} ${c.lastName}`.trim(),
      status: c.status, companyId: c.companyId, notes: scrub(c.notes),
      createdAt: c.createdAt.toISOString(),
    })),
    deals: deals.map(r => ({
      id: r.id, title: scrub(r.title), value: r.value, stage: r.stage,
      closeDate: iso(r.closeDate), notes: scrub(r.notes), companyId: r.companyId,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    })),
    tasks: tasks.map(r => ({
      id: r.id, title: scrub(r.title), description: scrub(r.description),
      status: r.status, waitingFor: scrub(r.waitingFor), companyId: r.companyId,
      createdAt: r.createdAt.toISOString(),
    })),
    taskEvents: taskEvents.map(r => ({
      id: r.id, actor: r.actor, action: r.action, field: r.field,
      before: r.before, after: r.after, createdAt: r.createdAt.toISOString(),
      taskTitle: scrub(r.task.title), companyId: r.task.companyId,
    })),
    activities: activities.map(r => ({
      id: r.id, type: r.type, subject: scrub(r.subject),
      description: scrub(r.description), outcome: scrub(r.outcome),
      activityDate: r.activityDate.toISOString(), companyId: r.companyId,
      contactId: r.contactId, createdAt: r.createdAt.toISOString(),
    })),
    invoices: invoices.map(r => ({
      id: r.id, number: r.number, date: r.date.toISOString(),
      dueDate: r.dueDate.toISOString(), total: r.total, paidAt: iso(r.paidAt),
      companyId: r.companyId,
    })),
    orders: orders.map(r => ({
      id: r.id, number: r.number, date: r.date.toISOString(), total: r.total,
      notes: scrub(r.notes), internalNotes: scrub(r.internalNotes),
      deliveryDate: iso(r.deliveryDate), companyId: r.companyId,
      items: r.items.map(it => ({ description: it.description, quantity: it.quantity })),
    })),
    quotes: quotes.map(r => ({
      id: r.id, number: r.number, date: r.date.toISOString(), total: r.total,
      notes: scrub(r.notes), companyId: r.companyId,
    })),
    deliveryNotes: deliveryNotes.map(r => ({
      id: r.id, number: r.number, date: r.date.toISOString(), total: r.total,
      notes: scrub(r.notes), companyId: r.companyId,
    })),
    memoryEntries: memoryEntries.map(r => ({
      id: r.id, content: scrub(r.content), date: iso(r.date), source: r.source,
      companyId: r.companyId, createdAt: r.createdAt.toISOString(),
      typeLabel: r.type.label,
    })),
    stockMovements: stockMovements.map(r => ({
      id: r.id, type: r.type, quantity: r.quantity, note: scrub(r.note),
      createdAt: r.createdAt.toISOString(), productName: r.product.name,
    })),
    expenses: expenses.map(r => ({
      id: r.id, date: r.date.toISOString(), vendor: anonymize ? 'Szállító' : r.vendor,
      description: scrub(r.description), amount: r.amount,
      totalAmount: r.totalAmount, currency: r.currency,
    })),
    purchaseOrders: purchaseOrders.map(r => ({
      id: r.id, number: r.number, notes: scrub(r.notes),
      orderedAt: iso(r.orderedAt), createdAt: r.createdAt.toISOString(),
      supplierName: anonymize ? 'Beszállító' : r.supplier.name,
    })),
  }
  snapshot.counts = Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length]),
  )

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 1))
  if (anonymize) {
    fs.writeFileSync(outFile + '.mapping.json', JSON.stringify({
      companies: Object.fromEntries(companies.map(c => [companyAlias.get(c.id), c.name])),
      contacts: Object.fromEntries(contacts.map(c => [contactAlias.get(c.id), `${c.firstName} ${c.lastName}`.trim()])),
    }, null, 2))
    console.log(`Feloldó térkép: ${outFile}.mapping.json — ezt NE add oda a modellnek.`)
  }
  console.log(`Kész: ${outFile}`)
  console.log(Object.entries(snapshot.counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
}

main().catch(err => { console.error(err); process.exit(1) })
