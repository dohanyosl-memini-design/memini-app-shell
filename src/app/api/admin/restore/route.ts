import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RestoreMode = 'safe' | 'full'

export async function POST(request: NextRequest) {
  const body = await request.json() as { backup: Record<string, unknown>; mode: RestoreMode }
  const { backup, mode } = body

  if (!backup?.data || !backup?.meta) {
    return NextResponse.json({ error: 'Érvénytelen backup fájl' }, { status: 400 })
  }

  const d = backup.data as Record<string, unknown[]>
  const results: Record<string, number> = {}

  try {
    if (mode === 'full') {
      // Törlés fordított FK-sorrendben
      await prisma.$transaction([
        prisma.memoryEntry.deleteMany(),
        prisma.commTemplate.deleteMany(),
        prisma.stockMovement.deleteMany(),
        prisma.purchaseOrderItem.deleteMany(),
        prisma.purchaseOrder.deleteMany(),
        prisma.deliveryNoteItem.deleteMany(),
        prisma.deliveryNote.deleteMany(),
        prisma.orderItem.deleteMany(),
        prisma.order.deleteMany(),
        prisma.quoteItem.deleteMany(),
        prisma.quote.deleteMany(),
        prisma.invoiceItem.deleteMany(),
        prisma.invoice.deleteMany(),
        prisma.activity.deleteMany(),
        prisma.subTask.deleteMany(),
        prisma.task.deleteMany(),
        prisma.deal.deleteMany(),
        prisma.product.deleteMany(),
        prisma.contact.deleteMany(),
        prisma.company.deleteMany(),
        prisma.carrier.deleteMany(),
        prisma.supplier.deleteMany(),
        prisma.priceListEntry.deleteMany(),
        prisma.transaction.deleteMany(),
        prisma.expense.deleteMany(),
        prisma.recurringExpense.deleteMany(),
        prisma.memoryEntryType.deleteMany(),
        prisma.templateType.deleteMany(),
      ])
    }

    const skip = mode === 'safe'

    // 1. Független alap táblák
    if (d.memoryEntryTypes?.length) {
      const r = await prisma.memoryEntryType.createMany({
        data: (d.memoryEntryTypes as {id:string;label:string;icon:string;color:string;isSystem:boolean;order:number;createdAt:string}[]).map(x => ({
          id: x.id, label: x.label, icon: x.icon, color: x.color,
          isSystem: x.isSystem, order: x.order, createdAt: new Date(x.createdAt),
        })),
        skipDuplicates: skip,
      })
      results.memoryEntryTypes = r.count
    }

    if (d.templateTypes?.length) {
      const r = await prisma.templateType.createMany({
        data: (d.templateTypes as {id:string;label:string;icon:string;isSystem:boolean;order:number;createdAt:string}[]).map(x => ({
          id: x.id, label: x.label, icon: x.icon,
          isSystem: x.isSystem, order: x.order, createdAt: new Date(x.createdAt),
        })),
        skipDuplicates: skip,
      })
      results.templateTypes = r.count
    }

    if (d.suppliers?.length) {
      const r = await prisma.supplier.createMany({
        data: (d.suppliers as {id:string;name:string;contactName?:string;email?:string;phone?:string;address?:string;city?:string;zip?:string;country:string;website?:string;vatId?:string;notes?:string;active:boolean;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, name: x.name, contactName: x.contactName ?? null,
          email: x.email ?? null, phone: x.phone ?? null, address: x.address ?? null,
          city: x.city ?? null, zip: x.zip ?? null, country: x.country ?? 'DE',
          website: x.website ?? null, vatId: x.vatId ?? null, notes: x.notes ?? null,
          active: x.active ?? true, createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.suppliers = r.count
    }

    if (d.carriers?.length) {
      const r = await prisma.carrier.createMany({
        data: (d.carriers as {id:string;code:string;name:string;nameDE?:string;group?:string;sortOrder:number;supplierId?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, code: x.code, name: x.name, nameDE: x.nameDE ?? null,
          group: x.group ?? null, sortOrder: x.sortOrder ?? 0,
          supplierId: x.supplierId ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.carriers = r.count
    }

    // 2. Cégek és kapcsolatok
    if (d.companies?.length) {
      const r = await prisma.company.createMany({
        data: (d.companies as {id:string;name:string;partnerType?:string;industry?:string;website?:string;phone?:string;email?:string;address?:string;zip?:string;city?:string;region?:string;country?:string;vatId?:string;customerNumber?:string;classification?:string;language?:string;channel?:string;notes?:string;businessHours?:unknown;lastOrderDate?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, name: x.name, partnerType: x.partnerType ?? null,
          industry: x.industry ?? null, website: x.website ?? null,
          phone: x.phone ?? null, email: x.email ?? null, address: x.address ?? null,
          zip: x.zip ?? null, city: x.city ?? null, region: x.region ?? null,
          country: x.country ?? 'DE', vatId: x.vatId ?? null,
          customerNumber: x.customerNumber ?? null, classification: x.classification ?? 'D',
          language: x.language ?? 'DE', channel: x.channel ?? null,
          notes: x.notes ?? null, businessHours: x.businessHours ?? undefined,
          lastOrderDate: x.lastOrderDate ? new Date(x.lastOrderDate) : null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.companies = r.count
    }

    if (d.contacts?.length) {
      const r = await prisma.contact.createMany({
        data: (d.contacts as {id:string;salutation?:string;firstName:string;lastName:string;email?:string;phone?:string;status:string;notes?:string;companyId?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, salutation: x.salutation ?? null, firstName: x.firstName,
          lastName: x.lastName, email: x.email ?? null, phone: x.phone ?? null,
          status: x.status ?? 'lead', notes: x.notes ?? null,
          companyId: x.companyId ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.contacts = r.count
    }

    // 3. Termékek
    if (d.products?.length) {
      const r = await prisma.product.createMany({
        data: (d.products as {id:string;name:string;nameDE?:string;sku:string;description?:string;material?:string;productType?:string;site?:string;city?:string;locationCabinet?:string;locationShelf?:string;locationBox?:string;costPrice:number;salesPrice:number;stock:number;minStock:number;unit:string;vatRate:number;active:boolean;imageUrl?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, name: x.name, nameDE: x.nameDE ?? null, sku: x.sku,
          description: x.description ?? null, material: x.material ?? null,
          productType: x.productType ?? null, site: x.site ?? null, city: x.city ?? null,
          locationCabinet: x.locationCabinet ?? null, locationShelf: x.locationShelf ?? null,
          locationBox: x.locationBox ?? null, costPrice: x.costPrice ?? 0,
          salesPrice: x.salesPrice ?? 0, stock: x.stock ?? 0, minStock: x.minStock ?? 10,
          unit: x.unit ?? 'db', vatRate: x.vatRate ?? 19, active: x.active ?? true,
          imageUrl: x.imageUrl ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.products = r.count
    }

    // 4. Pénzügyi alap táblák
    if (d.priceListEntries?.length) {
      const r = await prisma.priceListEntry.createMany({
        data: (d.priceListEntries as {id:string;hordozo:string;ar1:number;ar2:number;ar3:number;ar4:number;ar5:number;ar6:number;ar7:number;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, hordozo: x.hordozo, ar1: x.ar1, ar2: x.ar2, ar3: x.ar3,
          ar4: x.ar4, ar5: x.ar5, ar6: x.ar6, ar7: x.ar7,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.priceListEntries = r.count
    }

    if (d.transactions?.length) {
      const r = await prisma.transaction.createMany({
        data: (d.transactions as {id:string;type:string;amount:number;currency:string;date:string;description:string;category?:string;reference?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, type: x.type, amount: x.amount, currency: x.currency ?? 'EUR',
          date: new Date(x.date), description: x.description,
          category: x.category ?? null, reference: x.reference ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.transactions = r.count
    }

    if (d.expenses?.length) {
      const r = await prisma.expense.createMany({
        data: (d.expenses as {id:string;date:string;vendor:string;description:string;amount:number;vatAmount:number;totalAmount:number;currency:string;eurAmount?:number;eurRate?:number;category?:string;status:string;notes?:string;receiptUrl?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, date: new Date(x.date), vendor: x.vendor, description: x.description,
          amount: x.amount, vatAmount: x.vatAmount ?? 0, totalAmount: x.totalAmount,
          currency: x.currency ?? 'EUR', eurAmount: x.eurAmount ?? null,
          eurRate: x.eurRate ?? null, category: x.category ?? null,
          status: x.status ?? 'pending', notes: x.notes ?? null,
          receiptUrl: x.receiptUrl ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.expenses = r.count
    }

    if (d.recurringExpenses?.length) {
      const r = await prisma.recurringExpense.createMany({
        data: (d.recurringExpenses as {id:string;name:string;amount:number;currency:string;category?:string;frequency:string;nextDue:string;active:boolean;notes?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, name: x.name, amount: x.amount, currency: x.currency ?? 'EUR',
          category: x.category ?? null, frequency: x.frequency,
          nextDue: new Date(x.nextDue), active: x.active ?? true,
          notes: x.notes ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.recurringExpenses = r.count
    }

    // 5. Dealek, feladatok, aktivitások
    if (d.deals?.length) {
      const r = await prisma.deal.createMany({
        data: (d.deals as {id:string;title:string;value:number;stage:string;probability:number;closeDate?:string;notes?:string;contactId?:string;companyId?:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, title: x.title, value: x.value ?? 0, stage: x.stage ?? 'prospect',
          probability: x.probability ?? 0, closeDate: x.closeDate ? new Date(x.closeDate) : null,
          notes: x.notes ?? null, contactId: x.contactId ?? null, companyId: x.companyId ?? null,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.deals = r.count
    }

    if (d.tasks?.length) {
      type BackupTask = {id:string;title:string;description?:string;dueDate?:string;status:string;priority:string;taskType?:string;assigneeId?:string;contactId?:string;dealId?:string;companyId?:string;createdAt:string;updatedAt:string;subtasks?:{id:string;title:string;completed:boolean;taskId:string;createdAt:string}[]}
      let taskCount = 0; let subtaskCount = 0
      for (const x of d.tasks as BackupTask[]) {
        await prisma.task.upsert({
          where: { id: x.id },
          update: {},
          create: {
            id: x.id, title: x.title, description: x.description ?? null,
            dueDate: x.dueDate ? new Date(x.dueDate) : null,
            status: x.status ?? 'pending', priority: x.priority ?? 'medium',
            taskType: x.taskType ?? null, assigneeId: x.assigneeId ?? null,
            contactId: x.contactId ?? null, dealId: x.dealId ?? null,
            companyId: x.companyId ?? null,
            createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
          },
        })
        taskCount++
        if (x.subtasks?.length) {
          const sr = await prisma.subTask.createMany({
            data: x.subtasks.map(s => ({
              id: s.id, title: s.title, completed: s.completed, taskId: s.taskId,
              createdAt: new Date(s.createdAt),
            })),
            skipDuplicates: true,
          })
          subtaskCount += sr.count
        }
      }
      results.tasks = taskCount
      results.subtasks = subtaskCount
    }

    if (d.activities?.length) {
      const r = await prisma.activity.createMany({
        data: (d.activities as {id:string;type:string;subject?:string;description:string;activityDate:string;duration?:number;outcome?:string;contactId?:string;companyId?:string;dealId?:string;createdAt:string}[]).map(x => ({
          id: x.id, type: x.type, subject: x.subject ?? null,
          description: x.description, activityDate: new Date(x.activityDate),
          duration: x.duration ?? null, outcome: x.outcome ?? null,
          contactId: x.contactId ?? null, companyId: x.companyId ?? null,
          dealId: x.dealId ?? null, createdAt: new Date(x.createdAt),
        })),
        skipDuplicates: skip,
      })
      results.activities = r.count
    }

    // 6. Dokumentumok tételekkel
    type WithItems<T> = T & { items?: unknown[] }

    if (d.invoices?.length) {
      let count = 0
      for (const inv of d.invoices as WithItems<{id:string;number:string;date:string;dueDate:string;status:string;notes?:string;deliveryInfo?:string;stornoOf?:string;billingName?:string;billingAddress?:string;billingZip?:string;billingCity?:string;billingCountry?:string;contactId?:string;companyId?:string;subtotal:number;vatAmount:number;total:number;currency:string;paidAt?:string;createdAt:string;updatedAt:string}>[]) {
        await prisma.invoice.upsert({
          where: { id: inv.id },
          update: {},
          create: {
            id: inv.id, number: inv.number, date: new Date(inv.date),
            dueDate: new Date(inv.dueDate), status: inv.status ?? 'open',
            notes: inv.notes ?? null, deliveryInfo: inv.deliveryInfo ?? null,
            stornoOf: inv.stornoOf ?? null, billingName: inv.billingName ?? null,
            billingAddress: inv.billingAddress ?? null, billingZip: inv.billingZip ?? null,
            billingCity: inv.billingCity ?? null, billingCountry: inv.billingCountry ?? null,
            contactId: inv.contactId ?? null, companyId: inv.companyId ?? null,
            subtotal: inv.subtotal ?? 0, vatAmount: inv.vatAmount ?? 0,
            total: inv.total ?? 0, currency: inv.currency ?? 'EUR',
            paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
            createdAt: new Date(inv.createdAt), updatedAt: new Date(inv.updatedAt),
          },
        })
        if (inv.items?.length) {
          await prisma.invoiceItem.createMany({
            data: (inv.items as {id:string;description:string;quantity:number;unitPrice:number;vatRate:number;total:number;isDiscount:boolean;invoiceId:string;productId?:string}[]).map(i => ({
              id: i.id, description: i.description, quantity: i.quantity,
              unitPrice: i.unitPrice, vatRate: i.vatRate ?? 19, total: i.total,
              isDiscount: i.isDiscount ?? false, invoiceId: i.invoiceId,
              productId: i.productId ?? null,
            })),
            skipDuplicates: true,
          })
        }
        count++
      }
      results.invoices = count
    }

    if (d.orders?.length) {
      let count = 0
      for (const ord of d.orders as WithItems<{id:string;number:string;date:string;status:string;total:number;notes?:string;contactId?:string;companyId?:string;deliveryDate?:string;createdAt:string;updatedAt:string}>[]) {
        await prisma.order.upsert({
          where: { id: ord.id },
          update: {},
          create: {
            id: ord.id, number: ord.number, date: new Date(ord.date),
            status: ord.status ?? 'pending', total: ord.total ?? 0,
            notes: ord.notes ?? null, contactId: ord.contactId ?? null,
            companyId: ord.companyId ?? null,
            deliveryDate: ord.deliveryDate ? new Date(ord.deliveryDate) : null,
            createdAt: new Date(ord.createdAt), updatedAt: new Date(ord.updatedAt),
          },
        })
        if (ord.items?.length) {
          await prisma.orderItem.createMany({
            data: (ord.items as {id:string;description:string;quantity:number;unitPrice:number;vatRate:number;total:number;orderId:string;productId?:string}[]).map(i => ({
              id: i.id, description: i.description, quantity: i.quantity,
              unitPrice: i.unitPrice, vatRate: i.vatRate ?? 19, total: i.total,
              orderId: i.orderId, productId: i.productId ?? null,
            })),
            skipDuplicates: true,
          })
        }
        count++
      }
      results.orders = count
    }

    if (d.deliveryNotes?.length) {
      let count = 0
      for (const dn of d.deliveryNotes as WithItems<{id:string;number:string;date:string;status:string;notes?:string;deliveryInfo?:string;billingName?:string;billingAddress?:string;billingZip?:string;billingCity?:string;contactId?:string;companyId?:string;createdAt:string;updatedAt:string}>[]) {
        await prisma.deliveryNote.upsert({
          where: { id: dn.id },
          update: {},
          create: {
            id: dn.id, number: dn.number, date: new Date(dn.date),
            status: dn.status ?? 'draft', notes: dn.notes ?? null,
            deliveryInfo: dn.deliveryInfo ?? null, billingName: dn.billingName ?? null,
            billingAddress: dn.billingAddress ?? null, billingZip: dn.billingZip ?? null,
            billingCity: dn.billingCity ?? null,
            contactId: dn.contactId ?? null, companyId: dn.companyId ?? null,
            createdAt: new Date(dn.createdAt), updatedAt: new Date(dn.updatedAt),
          },
        })
        if (dn.items?.length) {
          await prisma.deliveryNoteItem.createMany({
            data: (dn.items as {id:string;description:string;quantity:number;unitPrice:number;vatRate:number;total:number;isDiscount:boolean;deliveryNoteId:string;productId?:string}[]).map(i => ({
              id: i.id, description: i.description, quantity: i.quantity,
              unitPrice: i.unitPrice, vatRate: i.vatRate ?? 19, total: i.total,
              isDiscount: i.isDiscount ?? false,
              deliveryNoteId: i.deliveryNoteId, productId: i.productId ?? null,
            })),
            skipDuplicates: true,
          })
        }
        count++
      }
      results.deliveryNotes = count
    }

    if (d.purchaseOrders?.length) {
      let count = 0
      for (const po of d.purchaseOrders as WithItems<{id:string;number:string;status:string;notes?:string;supplierId:string;orderedAt?:string;createdAt:string;updatedAt:string}>[]) {
        await prisma.purchaseOrder.upsert({
          where: { id: po.id },
          update: {},
          create: {
            id: po.id, number: po.number, status: po.status ?? 'draft',
            notes: po.notes ?? null, supplierId: po.supplierId,
            orderedAt: po.orderedAt ? new Date(po.orderedAt) : null,
            createdAt: new Date(po.createdAt), updatedAt: new Date(po.updatedAt),
          },
        })
        if (po.items?.length) {
          await prisma.purchaseOrderItem.createMany({
            data: (po.items as {id:string;productId:string;quantity:number;unitPrice:number;note?:string;purchaseOrderId:string}[]).map(i => ({
              id: i.id, productId: i.productId, quantity: i.quantity,
              unitPrice: i.unitPrice ?? 0, note: i.note ?? null,
              purchaseOrderId: i.purchaseOrderId,
            })),
            skipDuplicates: true,
          })
        }
        count++
      }
      results.purchaseOrders = count
    }

    // 7. Készletmozgások
    if (d.products?.length) {
      let smCount = 0
      for (const prod of d.products as {movements?: {id:string;type:string;quantity:number;note?:string;supplier?:string;reference?:string;productId:string;createdAt:string}[]}[]) {
        if (prod.movements?.length) {
          const r = await prisma.stockMovement.createMany({
            data: prod.movements.map(m => ({
              id: m.id, type: m.type, quantity: m.quantity,
              note: m.note ?? null, supplier: m.supplier ?? null,
              reference: m.reference ?? null, productId: m.productId,
              createdAt: new Date(m.createdAt),
            })),
            skipDuplicates: true,
          })
          smCount += r.count
        }
      }
      results.stockMovements = smCount
    }

    // 8. Memória és sablonok
    if (d.memories?.length) {
      const r = await prisma.memoryEntry.createMany({
        data: (d.memories as {id:string;companyId?:string;contactId?:string;typeId:string;content:string;date?:string;source:string;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, companyId: x.companyId ?? null, contactId: x.contactId ?? null,
          typeId: x.typeId, content: x.content,
          date: x.date ? new Date(x.date) : null, source: x.source ?? 'user',
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.memories = r.count
    }

    if (d.templates?.length) {
      const r = await prisma.commTemplate.createMany({
        data: (d.templates as {id:string;name:string;typeId:string;subject?:string;bodyHu:string;description?:string;isActive:boolean;order:number;createdAt:string;updatedAt:string}[]).map(x => ({
          id: x.id, name: x.name, typeId: x.typeId, subject: x.subject ?? null,
          bodyHu: x.bodyHu, description: x.description ?? null,
          isActive: x.isActive ?? true, order: x.order ?? 0,
          createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt),
        })),
        skipDuplicates: skip,
      })
      results.templates = r.count
    }

    const total = Object.values(results).reduce((s, n) => s + n, 0)
    return NextResponse.json({ ok: true, mode, results, total })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
