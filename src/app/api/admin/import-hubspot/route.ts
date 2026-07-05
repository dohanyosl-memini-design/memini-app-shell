import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const HS_BASE = 'https://api.hubapi.com'

async function hsFetch(token: string, path: string) {
  const res = await fetch(`${HS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot ${path} → ${res.status}: ${err}`)
  }
  return res.json()
}

async function fetchAll(token: string, objectType: string, properties: string[]) {
  const results: Record<string, unknown>[] = []
  let after: string | undefined

  while (true) {
    const params = new URLSearchParams({
      limit: '100',
      properties: properties.join(','),
      associations: objectType === 'contacts' ? 'companies' : objectType === 'deals' ? 'contacts,companies' : '',
    })
    if (after) params.set('after', after)

    const data = await hsFetch(token, `/crm/v3/objects/${objectType}?${params}`)
    results.push(...data.results)

    if (data.paging?.next?.after) {
      after = data.paging.next.after
    } else {
      break
    }
  }

  return results
}

function mapDealStage(hsStage: string): string {
  const map: Record<string, string> = {
    appointmentscheduled: 'outreach_sent',
    qualifiedtobuy: 'follow_up',
    presentationscheduled: 'sample_requested',
    decisionmakerboughtin: 'sample_sent',
    contractsent: 'sample_sent',
    closedwon: 'won',
    closedlost: 'lost',
  }
  return map[hsStage] ?? 'outreach_sent'
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? process.env.HUBSPOT_TOKEN
  if (!token) return NextResponse.json({ error: 'token hiányzik' }, { status: 400 })

  const log: string[] = []
  let companiesCreated = 0, contactsCreated = 0, dealsCreated = 0, errors = 0

  try {
    // ── 1. Companies ──────────────────────────────────────────────
    log.push('Cégek lekérése HubSpot-ból...')
    const hsCompanies = await fetchAll(token, 'companies', [
      'name', 'domain', 'phone', 'email', 'address', 'city', 'country', 'zip', 'website', 'industry',
    ])
    log.push(`${hsCompanies.length} cég találva`)

    const hsIdToCompanyId = new Map<string, string>()

    for (const hs of hsCompanies) {
      const p = hs.properties as Record<string, string>
      if (!p.name) continue
      try {
        const existing = await prisma.company.findFirst({ where: { name: p.name } })
        if (existing) {
          hsIdToCompanyId.set(hs.id as string, existing.id)
          continue
        }
        const company = await prisma.company.create({
          data: {
            name: p.name,
            website: p.domain ?? p.website ?? null,
            phone: p.phone ?? null,
            email: p.email ?? null,
            address: p.address ?? null,
            city: p.city ?? null,
            country: p.country ?? 'DE',
            industry: p.industry ?? null,
          },
        })
        hsIdToCompanyId.set(hs.id as string, company.id)
        companiesCreated++
      } catch {
        errors++
      }
    }
    log.push(`${companiesCreated} cég létrehozva`)

    // ── 2. Contacts ───────────────────────────────────────────────
    log.push('Kontaktok lekérése...')
    const hsContacts = await fetchAll(token, 'contacts', [
      'firstname', 'lastname', 'email', 'phone', 'hs_lead_status', 'notes_last_body',
    ])
    log.push(`${hsContacts.length} kontakt találva`)

    const hsContactIdToId = new Map<string, string>()

    for (const hs of hsContacts) {
      const p = hs.properties as Record<string, string>
      const firstName = p.firstname ?? ''
      const lastName = p.lastname ?? ''
      if (!firstName && !lastName) continue

      const assocCompanyIds = (hs as Record<string, unknown>).associations
        ? ((hs as Record<string, Record<string, {results: {id: string}[]}>>) .associations?.companies?.results ?? []).map((r: {id: string}) => r.id)
        : []
      const companyId = assocCompanyIds.length > 0 ? hsIdToCompanyId.get(assocCompanyIds[0]) ?? null : null

      try {
        const existing = await prisma.contact.findFirst({
          where: { firstName, lastName, email: p.email ?? null },
        })
        if (existing) {
          hsContactIdToId.set(hs.id as string, existing.id)
          continue
        }
        const contact = await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email: p.email ?? null,
            phone: p.phone ?? null,
            status: p.hs_lead_status === 'OPEN_DEAL' ? 'customer' : 'lead',
            companyId,
          },
        })
        hsContactIdToId.set(hs.id as string, contact.id)
        contactsCreated++
      } catch {
        errors++
      }
    }
    log.push(`${contactsCreated} kontakt létrehozva`)

    // ── 3. Deals ──────────────────────────────────────────────────
    log.push('Dealek lekérése...')
    const hsDeals = await fetchAll(token, 'deals', [
      'dealname', 'amount', 'dealstage', 'closedate', 'hs_deal_stage_probability',
    ])
    log.push(`${hsDeals.length} deal találva`)

    for (const hs of hsDeals) {
      const p = hs.properties as Record<string, string>
      if (!p.dealname) continue

      const assocContactIds = ((hs as Record<string, Record<string, {results: {id: string}[]}>>) .associations?.contacts?.results ?? []).map((r: {id: string}) => r.id)
      const assocCompanyIds = ((hs as Record<string, Record<string, {results: {id: string}[]}>>) .associations?.companies?.results ?? []).map((r: {id: string}) => r.id)

      const contactId = assocContactIds.length > 0 ? hsContactIdToId.get(assocContactIds[0]) ?? null : null
      const companyId = assocCompanyIds.length > 0 ? hsIdToCompanyId.get(assocCompanyIds[0]) ?? null : null

      try {
        const existing = await prisma.deal.findFirst({ where: { title: p.dealname } })
        if (existing) continue

        await prisma.deal.create({
          data: {
            title: p.dealname,
            value: parseFloat(p.amount ?? '0') || 0,
            stage: mapDealStage(p.dealstage ?? ''),
            probability: parseInt(p.hs_deal_stage_probability ?? '0') || 0,
            closeDate: p.closedate ? new Date(p.closedate) : null,
            contactId,
            companyId,
          },
        })
        dealsCreated++
      } catch {
        errors++
      }
    }
    log.push(`${dealsCreated} deal létrehozva`)

    return NextResponse.json({
      ok: true,
      companiesCreated,
      contactsCreated,
      dealsCreated,
      errors,
      log,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), log }, { status: 500 })
  }
}
