import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Memini Design database...')

  // Companies (partner gift shops)
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        name: 'Ulmer Münster Shop',
        industry: 'Kirchlicher Souvenirladen',
        website: 'ulmer-muenster.de',
        phone: '+49 731 379 415',
        address: 'Münsterplatz 1',
        city: 'Ulm',
        country: 'DE',
        vatId: 'DE123456789',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Schloss Heidelberg Gift Shop',
        industry: 'Museum & Schloss Souvenirladen',
        website: 'schloss-heidelberg.de',
        phone: '+49 6221 658880',
        address: 'Schlosshof 1',
        city: 'Heidelberg',
        country: 'DE',
        vatId: 'DE234567890',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Neuschwanstein Souvenir GmbH',
        industry: 'Touristische Attraktionen',
        website: 'neuschwanstein.de',
        phone: '+49 8362 939880',
        address: 'Neuschwansteinstraße 20',
        city: 'Schwangau',
        country: 'DE',
        vatId: 'DE345678901',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Kölner Dom Shop',
        industry: 'Kirchlicher Souvenirladen',
        website: 'koelner-dom.de',
        phone: '+49 221 9258473',
        address: 'Domkloster 3',
        city: 'Köln',
        country: 'DE',
        vatId: 'DE456789012',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Rothenburg Tourist Center',
        industry: 'Tourismus',
        website: 'rothenburg.de',
        phone: '+49 9861 404800',
        address: 'Marktplatz 2',
        city: 'Rothenburg ob der Tauber',
        country: 'DE',
        vatId: 'DE567890123',
      },
    }),
  ])

  // Contacts (shop managers, buyers)
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        firstName: 'Klaus',
        lastName: 'Müller',
        email: 'k.mueller@ulmer-muenster.de',
        phone: '+49 731 379416',
        status: 'active',
        companyId: companies[0].id,
        notes: 'Boltvezető, havonta rendel, nagy mennyiségek',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Sabine',
        lastName: 'Wagner',
        email: 's.wagner@schloss-heidelberg.de',
        phone: '+49 6221 658881',
        status: 'active',
        companyId: companies[1].id,
        notes: 'Beszerző, minőségtudatos',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Thomas',
        lastName: 'Bauer',
        email: 't.bauer@neuschwanstein.de',
        phone: '+49 8362 939881',
        status: 'active',
        companyId: companies[2].id,
        notes: 'Marketing vezető, nagy forgalom nyáron',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'a.schmidt@koelner-dom.de',
        phone: '+49 221 9258474',
        status: 'lead',
        companyId: companies[3].id,
        notes: 'Intézményvezető, döntéshozó',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Michael',
        lastName: 'Braun',
        email: 'm.braun@rothenburg.de',
        phone: '+49 9861 404801',
        status: 'active',
        companyId: companies[4].id,
      },
    }),
  ])

  // Deals
  const now = new Date()
  const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const future60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        title: 'Ulmer Münster – Kő mágnes kollekció 200 db',
        value: 1800,
        stage: 'sample_requested',
        probability: 70,
        contactId: contacts[0].id,
        companyId: companies[0].id,
        closeDate: future30,
        notes: 'Ajánlat elküldve, várjuk a visszajelzést',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Heidelberg Schloss – Fa mágnes 150 db + képeslapok',
        value: 2100,
        stage: 'sample_sent',
        probability: 80,
        contactId: contacts[1].id,
        companyId: companies[1].id,
        closeDate: future30,
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Neuschwanstein – Nyári kollekcó 500 db',
        value: 4500,
        stage: 'won',
        probability: 100,
        contactId: contacts[2].id,
        companyId: companies[2].id,
        closeDate: past30,
        notes: 'Leszállítva, elégedett ügyfél',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Kölner Dom – Próbarendelés 50 db',
        value: 650,
        stage: 'follow_up',
        probability: 45,
        contactId: contacts[3].id,
        companyId: companies[3].id,
        closeDate: future60,
        notes: 'Mintákat kértek, döntés folyamatban',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Rothenburg – Fa kollekció 100 db',
        value: 1200,
        stage: 'outreach_sent',
        probability: 25,
        contactId: contacts[4].id,
        companyId: companies[4].id,
        closeDate: future60,
      },
    }),
  ])

  // Products (Memini Design SKUs)
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Ulmer Münster – Kő hűtőmágnes',
        sku: 'MM-ULM-001-KO',
        material: 'stone',
        productType: 'magnet',
        site: 'Ulmer Münster',
        city: 'Ulm',
        costPrice: 3.2,
        salesPrice: 7.5,
        stock: 245,
        minStock: 50,
        vatRate: 19,
        description: 'Természetes kőből készült hűtőmágnes UV nyomtatással',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Ulmer Münster – Fa hűtőmágnes',
        sku: 'MM-ULM-002-FA',
        material: 'wood',
        productType: 'magnet',
        site: 'Ulmer Münster',
        city: 'Ulm',
        costPrice: 2.8,
        salesPrice: 6.5,
        stock: 180,
        minStock: 50,
        vatRate: 19,
        description: 'Lézervágott fa mágnes',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Heidelberg Schloss – Kő hűtőmágnes',
        sku: 'MM-HEI-001-KO',
        material: 'stone',
        productType: 'magnet',
        site: 'Heidelberg Schloss',
        city: 'Heidelberg',
        costPrice: 3.2,
        salesPrice: 7.5,
        stock: 320,
        minStock: 60,
        vatRate: 19,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Heidelberg Schloss – Fa képeslap',
        sku: 'MM-HEI-002-FK',
        material: 'wood',
        productType: 'postcard',
        site: 'Heidelberg Schloss',
        city: 'Heidelberg',
        costPrice: 1.5,
        salesPrice: 3.9,
        stock: 150,
        minStock: 30,
        vatRate: 7,
        description: 'Lézervágott fa képeslap',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Neuschwanstein – Kő hűtőmágnes',
        sku: 'MM-NEU-001-KO',
        material: 'stone',
        productType: 'magnet',
        site: 'Schloss Neuschwanstein',
        city: 'Schwangau',
        costPrice: 3.2,
        salesPrice: 7.9,
        stock: 520,
        minStock: 100,
        vatRate: 19,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Neuschwanstein – PLA 3D mágnes',
        sku: 'MM-NEU-002-PL',
        material: 'pla',
        productType: 'magnet',
        site: 'Schloss Neuschwanstein',
        city: 'Schwangau',
        costPrice: 2.1,
        salesPrice: 5.9,
        stock: 8,
        minStock: 50,
        vatRate: 19,
        description: '3D nyomtatott bioműanyag mágnes',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Kölner Dom – Hatszög kő mágnes',
        sku: 'MM-KOE-001-KO',
        material: 'stone',
        productType: 'magnet',
        site: 'Kölner Dom',
        city: 'Köln',
        costPrice: 3.5,
        salesPrice: 8.5,
        stock: 0,
        minStock: 40,
        vatRate: 19,
        description: 'Hatszög formátumú prémium kő mágnes',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Rothenburg – Fa hűtőmágnes (többrétegű)',
        sku: 'MM-ROT-001-FA',
        material: 'wood',
        productType: 'magnet',
        site: 'Rothenburg ob der Tauber',
        city: 'Rothenburg ob der Tauber',
        costPrice: 4.1,
        salesPrice: 9.5,
        stock: 75,
        minStock: 30,
        vatRate: 19,
        description: 'Többrétegű lézervágott fa mágnes',
      },
    }),
  ])

  // Stock movements
  await Promise.all([
    prisma.stockMovement.create({
      data: { type: 'in', quantity: 300, note: 'Gyártótól bevételezve', productId: products[0].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'out', quantity: 55, note: 'Ulmer Münster szállítás', productId: products[0].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'in', quantity: 200, note: 'Gyártótól bevételezve', productId: products[1].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'out', quantity: 20, note: 'Mintaszállítás', productId: products[1].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'in', quantity: 500, note: 'Neuschwanstein nyári szezon', productId: products[4].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'in', quantity: 10, note: 'Tesztgyártás', productId: products[5].id },
    }),
    prisma.stockMovement.create({
      data: { type: 'out', quantity: 2, note: 'Mintaküldés Kölnbe', productId: products[5].id },
    }),
  ])

  // Invoices
  const inv1Date = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  const inv2Date = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
  const inv3Date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

  const invoices = await Promise.all([
    prisma.invoice.create({
      data: {
        number: 'RE-2026-001',
        date: inv1Date,
        dueDate: new Date(inv1Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'paid',
        contactId: contacts[2].id,
        companyId: companies[2].id,
        currency: 'EUR',
        subtotal: 3781,
        vatAmount: 718.39,
        total: 4499.39,
        paidAt: new Date(inv1Date.getTime() + 15 * 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              description: 'Schloss Neuschwanstein – Kő hűtőmágnes (MM-NEU-001-KO)',
              quantity: 500,
              unitPrice: 7.9,
              vatRate: 19,
              total: 3950,
              productId: products[4].id,
            },
          ],
        },
      },
    }),
    prisma.invoice.create({
      data: {
        number: 'RE-2026-002',
        date: inv2Date,
        dueDate: new Date(inv2Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'open',
        contactId: contacts[1].id,
        companyId: companies[1].id,
        currency: 'EUR',
        subtotal: 1470,
        vatAmount: 279.3,
        total: 1749.3,
        items: {
          create: [
            {
              description: 'Heidelberg Schloss – Kő hűtőmágnes (MM-HEI-001-KO)',
              quantity: 120,
              unitPrice: 7.5,
              vatRate: 19,
              total: 900,
              productId: products[2].id,
            },
            {
              description: 'Heidelberg Schloss – Fa képeslap (MM-HEI-002-FK)',
              quantity: 150,
              unitPrice: 3.9,
              vatRate: 7,
              total: 585,
              productId: products[3].id,
            },
          ],
        },
      },
    }),
    prisma.invoice.create({
      data: {
        number: 'RE-2026-003',
        date: inv3Date,
        dueDate: new Date(inv3Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'open',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        currency: 'EUR',
        subtotal: 1500,
        vatAmount: 285,
        total: 1785,
        items: {
          create: [
            {
              description: 'Ulmer Münster – Kő hűtőmágnes (MM-ULM-001-KO)',
              quantity: 200,
              unitPrice: 7.5,
              vatRate: 19,
              total: 1500,
              productId: products[0].id,
            },
          ],
        },
      },
    }),
  ])

  // Transactions
  await Promise.all([
    // Income
    prisma.transaction.create({
      data: {
        type: 'income',
        amount: 4499.39,
        currency: 'EUR',
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        description: 'Neuschwanstein – RE-2026-001 kifizetés',
        category: 'Értékesítés',
        reference: 'RE-2026-001',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'income',
        amount: 950,
        currency: 'EUR',
        date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        description: 'Rothenburg – előző negyedév',
        category: 'Értékesítés',
      },
    }),
    // Expenses
    prisma.transaction.create({
      data: {
        type: 'expense',
        amount: 1200,
        currency: 'EUR',
        date: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000),
        description: 'Gyártási költség – kő mágnesek (500 db)',
        category: 'Gyártás',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'expense',
        amount: 340,
        currency: 'EUR',
        date: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        description: 'Szállítási költség – Neuschwanstein',
        category: 'Szállítás',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'expense',
        amount: 89,
        currency: 'EUR',
        date: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        description: 'Figma előfizetés – Design szoftver',
        category: 'Szoftver',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'expense',
        amount: 560,
        currency: 'EUR',
        date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        description: 'Fa alapanyag – következő gyártási batch',
        category: 'Alapanyag',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'expense',
        amount: 210,
        currency: 'EUR',
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        description: 'Minta szállítás – Köln',
        category: 'Szállítás',
      },
    }),
    prisma.transaction.create({
      data: {
        type: 'income',
        amount: 320,
        currency: 'EUR',
        date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        description: 'Mintarendelés – Heidelberg előleg',
        category: 'Értékesítés',
      },
    }),
  ])

  // Tasks
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  await Promise.all([
    prisma.task.create({
      data: {
        title: 'RE-2026-002 fizetési emlékeztető – Heidelberg',
        description: 'A számla 10 napon belül lejár, küldj emlékeztetőt Sabine Wagnernek',
        dueDate: tomorrow,
        priority: 'high',
        status: 'pending',
        contactId: contacts[1].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Kölner Dom mintacsomag összeállítása',
        description: '3 db kő mágnes + 3 db fa mágnes küldése Anna Schmidtnek',
        dueDate: tomorrow,
        priority: 'high',
        status: 'in_progress',
        contactId: contacts[3].id,
        dealId: deals[3].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'PLA mágnes készlethiány – gyártás indítása',
        description: 'MM-NEU-002-PL csak 8 db van, minimum 50. Gyártóval egyeztetni.',
        dueDate: tomorrow,
        priority: 'high',
        status: 'pending',
      },
    }),
    prisma.task.create({
      data: {
        title: 'Rothenburg ajánlat összeállítása',
        description: 'Fa mágnes kollekció 100 db – ajánlat elkészítése Michael Braunnak',
        dueDate: nextWeek,
        priority: 'medium',
        status: 'pending',
        contactId: contacts[4].id,
        dealId: deals[4].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Q2 termékfotók elkészítése',
        description: 'Új kollekcióhoz termékfotók – Heidelberg és Ulm vonalak',
        dueDate: nextWeek,
        priority: 'medium',
        status: 'pending',
      },
    }),
  ])

  console.log('✅ Memini Design seed data created successfully!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
