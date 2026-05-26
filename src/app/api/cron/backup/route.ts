import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [
    contacts, companies, deals, tasks, activities, products,
    invoices, quotes, orders, deliveryNotes, expenses,
    recurringExpenses, transactions, priceListEntries,
    carriers, suppliers, purchaseOrders,
    memoryEntryTypes, memories, templateTypes, templates,
  ] = await Promise.all([
    prisma.contact.findMany(),
    prisma.company.findMany(),
    prisma.deal.findMany(),
    prisma.task.findMany({ include: { subtasks: true } }),
    prisma.activity.findMany(),
    prisma.product.findMany({ include: { movements: true } }),
    prisma.invoice.findMany({ include: { items: true } }),
    prisma.quote.findMany({ include: { items: true } }),
    prisma.order.findMany({ include: { items: true } }),
    prisma.deliveryNote.findMany({ include: { items: true } }),
    prisma.expense.findMany(),
    prisma.recurringExpense.findMany(),
    prisma.transaction.findMany(),
    prisma.priceListEntry.findMany(),
    prisma.carrier.findMany(),
    prisma.supplier.findMany(),
    prisma.purchaseOrder.findMany({ include: { items: true } }),
    prisma.memoryEntryType.findMany(),
    prisma.memoryEntry.findMany(),
    prisma.templateType.findMany(),
    prisma.commTemplate.findMany(),
  ])

  const backup = {
    meta: {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      app: 'Memini CRM',
      trigger: 'cron',
    },
    counts: {
      contacts: contacts.length,
      companies: companies.length,
      deals: deals.length,
      tasks: tasks.length,
      activities: activities.length,
      products: products.length,
      invoices: invoices.length,
      quotes: quotes.length,
      orders: orders.length,
      deliveryNotes: deliveryNotes.length,
      expenses: expenses.length,
      recurringExpenses: recurringExpenses.length,
      transactions: transactions.length,
      carriers: carriers.length,
      suppliers: suppliers.length,
      purchaseOrders: purchaseOrders.length,
      memories: memories.length,
      templates: templates.length,
    },
    data: {
      contacts, companies, deals, tasks, activities, products,
      invoices, quotes, orders, deliveryNotes, expenses,
      recurringExpenses, transactions, priceListEntries,
      carriers, suppliers, purchaseOrders,
      memoryEntryTypes, memories, templateTypes, templates,
    },
  }

  const json = JSON.stringify(backup)
  const filename = `backups/memini-backup-${format(new Date(), 'yyyy-MM-dd')}.json`

  const blob = await put(filename, json, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  return NextResponse.json({
    ok: true,
    url: blob.url,
    filename,
    counts: backup.counts,
    message: `Backup elmentve: ${filename}`,
  })
}
