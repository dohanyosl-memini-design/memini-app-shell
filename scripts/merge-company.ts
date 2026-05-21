import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all companies with "Ulm" + "Münster" in name
  const companies = await prisma.company.findMany({
    where: {
      AND: [
        { name: { contains: 'Ulm', mode: 'insensitive' } },
        { name: { contains: 'nster', mode: 'insensitive' } },
      ],
    },
    include: {
      invoices: { select: { id: true, number: true } },
      contacts: { select: { id: true, firstName: true, lastName: true } },
      deals: { select: { id: true, title: true } },
      activities: { select: { id: true } },
      quotes: { select: { id: true } },
      orders: { select: { id: true } },
      tasks: { select: { id: true } },
      deliveryNotes: { select: { id: true } },
    },
  })

  console.log(`Found ${companies.length} matching companies:\n`)
  for (const c of companies) {
    console.log(`  ID: ${c.id}`)
    console.log(`  Name: ${c.name}`)
    console.log(`  Invoices: ${c.invoices.map(i => i.number).join(', ') || 'none'}`)
    console.log(`  Contacts: ${c.contacts.map(c => `${c.firstName} ${c.lastName}`).join(', ') || 'none'}`)
    console.log()
  }

  if (companies.length < 2) {
    console.log('Nothing to merge.')
    return
  }

  // Pick the one with the most data as master (most invoices)
  const master = companies.reduce((best, c) => c.invoices.length >= best.invoices.length ? c : best, companies[0])
  const duplicates = companies.filter(c => c.id !== master.id)

  console.log(`Master company: ${master.name} (${master.id})`)
  console.log(`Merging ${duplicates.length} duplicate(s) into master...\n`)

  for (const dup of duplicates) {
    console.log(`Merging: ${dup.name} (${dup.id})`)

    await prisma.$transaction([
      prisma.invoice.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.contact.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.deal.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.activity.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.quote.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.order.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.task.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
      prisma.deliveryNote.updateMany({ where: { companyId: dup.id }, data: { companyId: master.id } }),
    ])

    // Merge notes if dup has any
    if (dup.notes && !master.notes) {
      await prisma.company.update({ where: { id: master.id }, data: { notes: dup.notes } })
    }

    await prisma.company.delete({ where: { id: dup.id } })
    console.log(`  Deleted duplicate ${dup.id}`)
  }

  // Verify result
  const result = await prisma.company.findUnique({
    where: { id: master.id },
    include: { invoices: { select: { number: true } } },
  })
  console.log(`\nDone! Master company now has ${result?.invoices.length} invoices:`)
  console.log(result?.invoices.map(i => `  ${i.number}`).join('\n'))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
