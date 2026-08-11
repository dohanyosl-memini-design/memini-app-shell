import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTemplateSteps } from '@/lib/emailTemplate'

export const dynamic = 'force-dynamic'

// A központi email-sorozat sablon lépései (üres tábla esetén az alapból feltöltve).
export async function GET() {
  const steps = await getTemplateSteps()
  return NextResponse.json(steps)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const count = await prisma.emailTemplateStep.count()
  const step = await prisma.emailTemplateStep.create({
    data: {
      label: body.label || 'Új levél',
      offsetDays: Number.isFinite(body.offsetDays) ? body.offsetDays : 0,
      subject: body.subject || null,
      brief: body.brief || null,
      sampleBody: body.sampleBody || null,
      order: body.order ?? count,
    },
  })
  return NextResponse.json(step, { status: 201 })
}
