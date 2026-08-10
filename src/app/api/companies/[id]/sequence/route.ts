import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseSequence, buildSequenceFromTemplate } from '@/lib/emailSequence'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// A cég email-sorozatának lekérése.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { emailSequence: true },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(parseSequence(company.emailSequence) ?? { steps: [] })
}

// A sorozat mentése (a UI a teljes, szerkesztett lépéssort küldi). Külön
// `reset: true`-val a sablonból újratölthető.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let body: { steps?: unknown; reset?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés-törzs.' }, { status: 400 })
  }

  const sequence = body.reset
    ? buildSequenceFromTemplate()
    : (parseSequence({ steps: body.steps }) ?? { steps: [] })

  await prisma.company.update({
    where: { id: params.id },
    data: { emailSequence: sequence as unknown as Prisma.InputJsonValue },
  })

  return NextResponse.json(sequence)
}
