import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CONTRACT_TITLE, DEFAULT_CONTRACT_BODY } from '@/lib/assetContractDefault'

export const dynamic = 'force-dynamic'

// Egyetlen sor (id: "default"). Ha még nincs, az alap német sablonnal jön létre,
// hogy a felhasználó ne üres lappal induljon.
async function getOrSeed() {
  const existing = await prisma.assetContractTemplate.findUnique({ where: { id: 'default' } })
  if (existing) return existing
  return prisma.assetContractTemplate.create({
    data: { id: 'default', titleDe: DEFAULT_CONTRACT_TITLE, bodyDe: DEFAULT_CONTRACT_BODY },
  })
}

export async function GET() {
  const tpl = await getOrSeed()
  return NextResponse.json(tpl)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const tpl = await prisma.assetContractTemplate.upsert({
    where: { id: 'default' },
    update: {
      titleDe: (body.titleDe ?? '').trim() || DEFAULT_CONTRACT_TITLE,
      bodyDe: body.bodyDe ?? '',
    },
    create: {
      id: 'default',
      titleDe: (body.titleDe ?? '').trim() || DEFAULT_CONTRACT_TITLE,
      bodyDe: body.bodyDe ?? DEFAULT_CONTRACT_BODY,
    },
  })
  return NextResponse.json(tpl)
}
