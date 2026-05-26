import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const { templateId, companyId, contactId } = await request.json()
  if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

  // Fetch template
  const template = await prisma.commTemplate.findUnique({
    where: { id: templateId },
    include: { type: true },
  })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Fetch company data
  let companyData: {
    name: string
    city: string | null
    lastOrderDate: string | null
    contacts: { firstName: string; lastName: string }[]
    activities: { activityDate: string }[]
    memories: { content: string; type: { label: string } }[]
  } | null = null

  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: { select: { firstName: true, lastName: true }, take: 1 },
        activities: { orderBy: { activityDate: 'desc' }, take: 1 },
        memories: { include: { type: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (company) {
      companyData = {
        name: company.name,
        city: company.city,
        lastOrderDate: company.lastOrderDate ? company.lastOrderDate.toISOString() : null,
        contacts: company.contacts,
        activities: company.activities.map(a => ({ activityDate: a.activityDate.toISOString() })),
        memories: company.memories.map(m => ({ content: m.content, type: { label: m.type.label } })),
      }
    }
  }

  // Fetch contact data
  let contactData: {
    firstName: string
    lastName: string
    memories: { content: string; type: { label: string } }[]
  } | null = null

  if (contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        memories: { include: { type: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (contact) {
      contactData = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        memories: contact.memories.map(m => ({ content: m.content, type: { label: m.type.label } })),
      }
    }
  }

  // Build context
  const cegnev = companyData?.name ?? ''
  const kapcsolattartoNeve = contactData
    ? `${contactData.firstName} ${contactData.lastName}`.trim()
    : companyData?.contacts[0]
      ? `${companyData.contacts[0].firstName} ${companyData.contacts[0].lastName}`.trim()
      : ''
  const varos = companyData?.city ?? ''
  const utolsoRendelesDatuma = companyData?.lastOrderDate
    ? new Date(companyData.lastOrderDate).toLocaleDateString('hu-HU')
    : ''
  const utolsoAktivitasDatuma = companyData?.activities[0]?.activityDate
    ? new Date(companyData.activities[0].activityDate).toLocaleDateString('hu-HU')
    : ''

  const allMemories = [
    ...(companyData?.memories ?? []),
    ...(contactData?.memories ?? []),
  ]
  const emlekek = allMemories
    .map(m => `[${m.type.label}] ${m.content}`)
    .join('\n')

  const contextBlock = `
Cég neve: ${cegnev || '(ismeretlen)'}
Kapcsolattartó neve: ${kapcsolattartoNeve || '(ismeretlen)'}
Város: ${varos || '(ismeretlen)'}
Utolsó rendelés dátuma: ${utolsoRendelesDatuma || '(nincs adat)'}
Utolsó aktivitás dátuma: ${utolsoAktivitasDatuma || '(nincs adat)'}
Memória bejegyzések:
${emlekek || '(nincs memória bejegyzés)'}
`.trim()

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Te egy CRM kommunikációs asszisztens vagy. A feladatod: egy sablon szöveg személyre szabása a rendelkezésre álló adatok alapján.
Cseréld le a sablon változóit ({cegnev}, {kapcsolattarto_neve}, {varos}, {utolso_rendeles_datuma}, {utolso_aktivitas_datuma}, {emlekek}) a megadott adatokra.
Ha egy adat nem elérhető, hagyd el vagy helyettesítsd természetes, folyékony szöveggel.
A memória bejegyzéseket akkor használd fel, ha relevánsak a szöveg személyre szabásához.
Csak a kész, személyre szabott szöveget add vissza, semmi mást.
Magyar nyelven dolgozz.`,
    messages: [
      {
        role: 'user',
        content: `Sablon típusa: ${template.type.label}\nSablon neve: ${template.name}\n\nSablon szöveg:\n${template.bodyHu}\n\nElérhető adatok:\n${contextBlock}`,
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const personalizedText = textBlock?.type === 'text' ? textBlock.text : template.bodyHu

  return NextResponse.json({
    text: personalizedText,
    template: {
      id: template.id,
      name: template.name,
      subject: template.subject,
      typeLabel: template.type.label,
    },
  })
}
