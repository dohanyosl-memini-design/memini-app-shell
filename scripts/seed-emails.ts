// Teszt-levelek a Levelek fül kipróbálásához, MIELŐTT az éles IMAP-szinkron
// megvan. Idempotens: ha a demó-szál már létezik, nem csinál semmit.
// A valódi Company rekordokhoz köt (ha vannak); különben demó-cégeket hoz létre,
// amiket a nevük alapján könnyű később törölni ("[DEMO]" előtag).
//
// Futtatás (ahol a DATABASE_URL él): npx tsx scripts/seed-emails.ts
// Törlés: a "[DEMO]" cégek + hozzájuk kötött szálak eltávolításával.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DEMO_MARKER = 'Nachbestellung Kühlschrankmagnete (demo)'

async function main() {
  const existing = await prisma.emailThread.findFirst({ where: { subject: DEMO_MARKER } })
  if (existing) {
    console.log('A demó-levelek már léteznek — nincs teendő.')
    return
  }

  const account = await prisma.emailAccount.upsert({
    where: { address: 'hello@memini-design.de' },
    update: {},
    create: { address: 'hello@memini-design.de', label: 'Memini Postafiók', sentFolder: 'Sent' },
  })

  // Valódi cégek, ha vannak; különben demó-cégek.
  let companies = await prisma.company.findMany({ take: 3, orderBy: { createdAt: 'asc' } })
  if (companies.length < 3) {
    const demos = [
      { name: '[DEMO] Dom-Shop Heidelberg', city: 'Heidelberg' },
      { name: '[DEMO] Ulmer Münster Laden', city: 'Ulm' },
      { name: '[DEMO] Museumsshop Freiburg', city: 'Freiburg' },
    ]
    companies = []
    for (const d of demos) {
      companies.push(await prisma.company.create({
        data: { name: d.name, city: d.city, partnerType: 'gift_shop', classification: 'B', country: 'DE' },
      }))
    }
  }

  const now = Date.now()
  const day = (n: number) => new Date(now - n * 86400000)

  // 1) Dom-Shop — válaszra vár, agent-tervezettel
  const t1 = await prisma.emailThread.create({
    data: {
      subject: DEMO_MARKER, normalizedSubject: 'nachbestellung kühlschrankmagnete (demo)',
      firstMessageAt: day(2), lastMessageAt: day(0), messageCount: 3,
      replyStatus: 'unanswered', companyId: companies[0].id,
    },
  })
  const mkEmail = async (threadId: string, dir: string, subj: string, body: string, when: Date, from: string, fromName: string) => {
    const e = await prisma.email.create({
      data: {
        accountId: account.id, threadId, subject: subj,
        normalizedSubject: subj.toLowerCase(), textBody: body,
        snippet: body.replace(/\s+/g, ' ').slice(0, 200), direction: dir,
        folderName: dir === 'outbound' ? 'Sent' : 'INBOX',
        imapUid: BigInt(Math.floor(Math.random() * 1e9)), uidValidity: BigInt(1),
        fallbackHash: Math.random().toString(36).slice(2), sentAt: when, receivedAt: when,
      },
    })
    await prisma.emailParticipant.create({
      data: { emailId: e.id, type: 'from', emailAddress: from, displayName: fromName },
    })
    return e
  }
  await mkEmail(t1.id, 'inbound', DEMO_MARKER,
    'Guten Tag,\n\nwir möchten die Kühlschrankmagnete „Altstadt" nachbestellen – diesmal aber eine kleinere Menge als 250 Stück. Wäre das möglich?\n\nBeste Grüße\nA. Hemmler',
    day(2), 'hemmler@domshop-hd.de', 'Frau Hemmler')
  await mkEmail(t1.id, 'outbound', 'Re: ' + DEMO_MARKER,
    'Guten Tag Frau Hemmler,\n\ngerne prüfe ich die Konditionen für eine kleinere Nachbestellung und melde mich morgen.',
    day(1), 'hello@memini-design.de', 'Memini Design')
  await mkEmail(t1.id, 'inbound', 'Re: ' + DEMO_MARKER,
    'Vielen Dank – gibt es dazu schon Neuigkeiten? Wir würden gern vor dem Wochenende bestellen.',
    day(0), 'hemmler@domshop-hd.de', 'Frau Hemmler')
  await prisma.emailDraft.create({
    data: {
      threadId: t1.id, companyId: companies[0].id, source: 'agent', status: 'draft',
      toAddresses: ['hemmler@domshop-hd.de'], subject: 'Re: ' + DEMO_MARKER,
      bodyText: 'Guten Tag Frau Hemmler,\n\ngerne bieten wir Ihnen die „Altstadt"-Magnete auch in einer Startmenge von 100 Stück an. Den aktualisierten Staffelpreis füge ich bei; bei Bestellung bis Freitag liefern wir noch vor dem Wochenende.\n\nBeste Grüße\nLaci',
    },
  })

  // 2) Ulm — válaszra vár
  const t2 = await prisma.emailThread.create({
    data: {
      subject: 'Frage zur Mindestbestellmenge (MOQ) (demo)', normalizedSubject: 'frage zur mindestbestellmenge (moq) (demo)',
      firstMessageAt: day(1), lastMessageAt: day(1), messageCount: 1,
      replyStatus: 'unanswered', companyId: companies[1].id,
    },
  })
  await mkEmail(t2.id, 'inbound', 'Frage zur Mindestbestellmenge (MOQ) (demo)',
    'Sehr geehrte Damen und Herren,\n\nist eine Erstbestellung unter 250 Stück denkbar? Wir starten lieber kleiner und stocken bei Bedarf auf.',
    day(1), 'vogt@muenster-ulm.de', 'Herr Vogt')

  // 3) Freiburg — válaszolt
  const t3 = await prisma.emailThread.create({
    data: {
      subject: 'Musterpaket erhalten – Feedback (demo)', normalizedSubject: 'musterpaket erhalten – feedback (demo)',
      firstMessageAt: day(4), lastMessageAt: day(3), messageCount: 2,
      replyStatus: 'answered', companyId: companies[2].id,
    },
  })
  await mkEmail(t3.id, 'inbound', 'Musterpaket erhalten – Feedback (demo)',
    'Die Muster sind angekommen, die Qualität überzeugt uns. Wir melden uns in Kürze zur Bestellung.',
    day(4), 'braeuning@museumshop-fr.de', 'Frau Bräuning')
  await mkEmail(t3.id, 'outbound', 'Re: Musterpaket erhalten – Feedback (demo)',
    'Das freut mich sehr! Ich stehe für alle Fragen bereit.',
    day(3), 'hello@memini-design.de', 'Memini Design')

  console.log('Demó-levelek létrehozva:')
  console.log(`  Postafiók: ${account.address}`)
  console.log(`  3 szál (2 válaszra vár, 1 válaszolt), 1 agent-tervezet`)
  console.log(`  Cégek: ${companies.map(c => c.name).join(', ')}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
