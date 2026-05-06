import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const companies = await Promise.all([
    prisma.company.create({
      data: {
        name: 'Magyar Telekom Zrt.',
        industry: 'Telekommunikáció',
        website: 'telekom.hu',
        phone: '+36 1 458 0000',
        address: '1013 Budapest, Krisztina krt. 55.',
      },
    }),
    prisma.company.create({
      data: {
        name: 'OTP Bank Nyrt.',
        industry: 'Pénzügyi szolgáltatások',
        website: 'otpbank.hu',
        phone: '+36 1 366 6611',
        address: '1051 Budapest, Nádor u. 16.',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Richter Gedeon Nyrt.',
        industry: 'Gyógyszeripar',
        website: 'richter.hu',
        phone: '+36 1 431 4000',
        address: '1103 Budapest, Gyömrői út 19-21.',
      },
    }),
    prisma.company.create({
      data: {
        name: 'MOL Magyar Olaj- és Gázipari Nyrt.',
        industry: 'Energetika',
        website: 'mol.hu',
        phone: '+36 1 209 0000',
        address: '1117 Budapest, Október huszonharmadika u. 18.',
      },
    }),
    prisma.company.create({
      data: {
        name: 'Wizz Air Hungary Kft.',
        industry: 'Légitársaság',
        website: 'wizzair.com',
        phone: '+36 1 777 9996',
        address: '1185 Budapest, Budapest Liszt Ferenc Repülőtér',
      },
    }),
  ])

  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        firstName: 'András',
        lastName: 'Kovács',
        email: 'kovacs.andras@telekom.hu',
        phone: '+36 20 123 4567',
        status: 'active',
        companyId: companies[0].id,
        notes: 'IT vezető, döntéshozó',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Éva',
        lastName: 'Nagy',
        email: 'nagy.eva@otpbank.hu',
        phone: '+36 30 234 5678',
        status: 'active',
        companyId: companies[1].id,
        notes: 'Digitális transzformáció vezető',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Péter',
        lastName: 'Szabó',
        email: 'szabo.peter@richter.hu',
        phone: '+36 70 345 6789',
        status: 'lead',
        companyId: companies[2].id,
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Katalin',
        lastName: 'Horváth',
        email: 'horvath.katalin@mol.hu',
        phone: '+36 20 456 7890',
        status: 'active',
        companyId: companies[3].id,
        notes: 'Projekt menedzser, közvetlen kapcsolattartó',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Gábor',
        lastName: 'Tóth',
        email: 'toth.gabor@example.hu',
        phone: '+36 30 567 8901',
        status: 'lead',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Mária',
        lastName: 'Kiss',
        email: 'kiss.maria@wizzair.com',
        phone: '+36 70 678 9012',
        status: 'inactive',
        companyId: companies[4].id,
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'László',
        lastName: 'Varga',
        email: 'varga.laszlo@example.hu',
        phone: '+36 20 789 0123',
        status: 'active',
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Zsuzsanna',
        lastName: 'Molnár',
        email: 'molnar.zsuzsanna@telekom.hu',
        phone: '+36 30 890 1234',
        status: 'lead',
        companyId: companies[0].id,
      },
    }),
  ])

  const now = new Date()
  const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const future60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const future90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        title: 'Telekom ERP rendszer implementáció',
        value: 8500000,
        stage: 'proposal',
        probability: 60,
        contactId: contacts[0].id,
        companyId: companies[0].id,
        closeDate: future30,
        notes: 'Komplex ERP bevezetés, 6 hónapos projekt',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'OTP banki digitális platform',
        value: 15000000,
        stage: 'negotiation',
        probability: 75,
        contactId: contacts[1].id,
        companyId: companies[1].id,
        closeDate: future30,
        notes: 'Mobilbanki alkalmazás fejlesztése',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Richter CRM implementáció',
        value: 5200000,
        stage: 'qualified',
        probability: 40,
        contactId: contacts[2].id,
        companyId: companies[2].id,
        closeDate: future60,
      },
    }),
    prisma.deal.create({
      data: {
        title: 'MOL adatelemző platform',
        value: 22000000,
        stage: 'closed_won',
        probability: 100,
        contactId: contacts[3].id,
        companyId: companies[3].id,
        closeDate: past30,
        notes: 'Sikeres projekt, referencia ügyfél',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Wizz Air jegyrendszer integráció',
        value: 12500000,
        stage: 'prospect',
        probability: 20,
        contactId: contacts[5].id,
        companyId: companies[4].id,
        closeDate: future90,
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Telefonos értékesítési modul',
        value: 3800000,
        stage: 'closed_lost',
        probability: 0,
        contactId: contacts[7].id,
        companyId: companies[0].id,
        closeDate: past30,
        notes: 'Elveszett - versenytárs olcsóbb ajánlata',
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Webshop integráció és automatizálás',
        value: 2100000,
        stage: 'proposal',
        probability: 55,
        contactId: contacts[4].id,
        closeDate: future30,
      },
    }),
    prisma.deal.create({
      data: {
        title: 'HR szoftver implementáció',
        value: 6700000,
        stage: 'qualified',
        probability: 45,
        contactId: contacts[6].id,
        closeDate: future60,
      },
    }),
  ])

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  await Promise.all([
    prisma.task.create({
      data: {
        title: 'Telefonhívás Kovács Andrással',
        description: 'ERP ajánlat részleteinek egyeztetése, árról tárgyalás',
        dueDate: tomorrow,
        priority: 'high',
        status: 'pending',
        contactId: contacts[0].id,
        dealId: deals[0].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Ajánlat elküldése Nagy Évának',
        description: 'A digitális platform végső ajánlatának elkészítése és elküldése',
        dueDate: tomorrow,
        priority: 'high',
        status: 'in_progress',
        contactId: contacts[1].id,
        dealId: deals[1].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Demo prezentáció előkészítése',
        description: 'Richter CRM demo anyagok és slideok összeállítása',
        dueDate: nextWeek,
        priority: 'medium',
        status: 'pending',
        contactId: contacts[2].id,
        dealId: deals[2].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'MOL szerződés aláírás',
        description: 'Nyert deal - szerződéses dokumentumok aláíratása',
        dueDate: yesterday,
        priority: 'high',
        status: 'completed',
        contactId: contacts[3].id,
        dealId: deals[3].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Wizz Air igényfelmérő meeting',
        description: 'Jegyrendszer részletes igényeinek felmérése',
        dueDate: nextWeek,
        priority: 'medium',
        status: 'pending',
        contactId: contacts[5].id,
        dealId: deals[4].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Varga László követési hívás',
        description: 'HR szoftver projekt státusz egyeztetése',
        dueDate: tomorrow,
        priority: 'low',
        status: 'pending',
        contactId: contacts[6].id,
        dealId: deals[7].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Heti értékesítési riport összeállítása',
        description: 'Sales riport a menedzsmentnek - pipeline és forecast',
        dueDate: nextWeek,
        priority: 'medium',
        status: 'pending',
      },
    }),
    prisma.task.create({
      data: {
        title: 'CRM adatbázis tisztítás',
        description: 'Duplikált kapcsolatok és elavult adatok eltávolítása',
        dueDate: nextWeek,
        priority: 'low',
        status: 'pending',
      },
    }),
  ])

  await Promise.all([
    prisma.activity.create({
      data: {
        type: 'call',
        description: 'Bemutatkozó telefonhívás - érdeklődnek az ERP megoldás iránt',
        contactId: contacts[0].id,
        dealId: deals[0].id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'meeting',
        description: 'Személyes találkozó az OTP irodájában - igényfelmérés elvégezve',
        contactId: contacts[1].id,
        dealId: deals[1].id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'email',
        description: 'Ajánlat elküldve emailben - várakozunk a visszajelzésre',
        contactId: contacts[2].id,
        dealId: deals[2].id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'meeting',
        description: 'Szerződés sikeresen megkötve - projekt kick-off tervezés',
        contactId: contacts[3].id,
        dealId: deals[3].id,
      },
    }),
  ])

  console.log('✅ Seed data created successfully!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
