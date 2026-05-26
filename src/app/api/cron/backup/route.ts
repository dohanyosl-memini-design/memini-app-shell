import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { Resend } from 'resend'

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
  const today = format(new Date(), 'yyyy-MM-dd')
  const filename = `backups/memini-backup-${today}.json`

  const blob = await put(filename, json, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  // Email küldés ha be van állítva
  const emailTo = process.env.BACKUP_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  let emailSent = false

  if (emailTo && resendKey) {
    try {
      const resend = new Resend(resendKey)
      const c = backup.counts
      await resend.emails.send({
        from: 'Memini CRM <onboarding@resend.dev>',
        to: emailTo,
        subject: `Memini CRM – Napi mentés ${today}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1d4ed8;margin-bottom:4px">✅ Napi backup sikeres</h2>
            <p style="color:#6b7280;margin-top:0">${today}</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
              ${Object.entries(c).map(([k, v]) => `
              <tr>
                <td style="padding:6px 0;color:#374151;border-bottom:1px solid #f3f4f6">${k}</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${v}</td>
              </tr>`).join('')}
            </table>
            <p style="font-size:13px;color:#9ca3af">A backup fájl csatolva van. Mentsd el biztonságos helyre.</p>
          </div>
        `,
        attachments: [
          {
            filename: `memini-backup-${today}.json`,
            content: Buffer.from(json).toString('base64'),
          },
        ],
      })
      emailSent = true
    } catch {
      // email hiba nem állítja meg a backup folyamatot
    }
  }

  return NextResponse.json({
    ok: true,
    url: blob.url,
    filename,
    counts: backup.counts,
    emailSent,
    message: `Backup elmentve: ${filename}`,
  })
}
