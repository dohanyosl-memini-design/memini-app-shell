import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Default MemoryEntryTypes
  const memoryTypes = [
    { label: 'Szülinap', icon: '🎂', color: 'pink', isSystem: true, order: 1 },
    { label: 'Ezt mondta', icon: '💬', color: 'blue', isSystem: true, order: 2 },
    { label: 'Személyes adat', icon: '👤', color: 'purple', isSystem: true, order: 3 },
    { label: 'Üzleti info', icon: '🏢', color: 'green', isSystem: true, order: 4 },
    { label: 'Webes forrás', icon: '🌐', color: 'gray', isSystem: true, order: 5 },
    { label: 'Egyéb', icon: '📌', color: 'amber', isSystem: false, order: 6 },
  ]

  for (const mt of memoryTypes) {
    const existing = await prisma.memoryEntryType.findFirst({ where: { label: mt.label } })
    if (!existing) {
      await prisma.memoryEntryType.create({ data: mt })
    }
  }

  // Default TemplateTypes
  const templateTypes = [
    { label: 'Email', icon: '✉️', isSystem: true, order: 1 },
    { label: 'WhatsApp', icon: '💬', isSystem: true, order: 2 },
    { label: 'Telefon script', icon: '📞', isSystem: true, order: 3 },
  ]

  for (const tt of templateTypes) {
    const existing = await prisma.templateType.findFirst({ where: { label: tt.label } })
    if (!existing) {
      await prisma.templateType.create({ data: tt })
    }
  }

  // Sample CommTemplates
  const emailType = await prisma.templateType.findFirst({ where: { label: 'Email' } })
  const whatsappType = await prisma.templateType.findFirst({ where: { label: 'WhatsApp' } })
  const telefonType = await prisma.templateType.findFirst({ where: { label: 'Telefon script' } })

  const templates = [
    {
      name: 'Újrarendelés emlékeztető',
      typeId: emailType?.id,
      subject: 'Újrarendelés – {cegnev}',
      bodyHu: `Tisztelt {kapcsolattarto_neve}!\n\nRemélem, minden rendben van. Örömmel láttuk, hogy már {utolso_rendeles_datuma}-án nálunk vásárolt. Szeretnénk tudni, hogy elégedett-e termékeinkkel, és szívesen segítünk egy újabb rendelés összeállításában.\n\nVárjuk megkeresését!\n\nÜdvözlettel,\nMemini Design`,
      order: 1,
    },
    {
      name: 'Régen hallottunk önökről',
      typeId: whatsappType?.id,
      bodyHu: `Szia {kapcsolattarto_neve}! 👋\n\nRégen volt szó egymásról, remélem jól megy minden {cegnev}-nél! Van valami újdonságunk ami érdekelheti önt. Mikor lenne jó egy rövid egyeztetés? 😊`,
      order: 1,
    },
    {
      name: 'Bemutatkozó hívás script',
      typeId: telefonType?.id,
      bodyHu: `Bevezetés:\n"Jó napot kívánok! {kapcsolattarto_neve} vagyok? … Remek! Memini Design cégtől hívom, Dohányvölgyi Gabi."\n\nCél elmondása:\n"{cegnev} weboldala alapján úgy gondoltuk, hogy termékeink érdekesek lehetnek önöknek."\n\nKérdések:\n- Jelenleg milyen ajándék/szuvenír terméket kínálnak?\n- Kik a jelenlegi szállítóik?\n\nLezárás:\n"Küldhetek egy rövid katalógust emailben?"`,
      order: 1,
    },
  ]

  for (const tmpl of templates) {
    if (!tmpl.typeId) continue
    const existing = await prisma.commTemplate.findFirst({ where: { name: tmpl.name } })
    if (!existing) {
      await prisma.commTemplate.create({
        data: {
          name: tmpl.name,
          typeId: tmpl.typeId,
          subject: tmpl.subject ?? null,
          bodyHu: tmpl.bodyHu,
          order: tmpl.order,
        },
      })
    }
  }

  return NextResponse.json({ ok: true, message: 'Default types and templates seeded.' })
}
