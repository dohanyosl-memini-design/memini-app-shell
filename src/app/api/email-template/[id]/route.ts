import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.label !== undefined) data.label = body.label
  if (body.offsetDays !== undefined) data.offsetDays = Number(body.offsetDays) || 0
  if (body.subject !== undefined) data.subject = body.subject || null
  if (body.brief !== undefined) data.brief = body.brief || null
  if (body.sampleBody !== undefined) data.sampleBody = body.sampleBody || null
  if (body.order !== undefined) data.order = Number(body.order) || 0
  const step = await prisma.emailTemplateStep.update({ where: { id: params.id }, data })
  return NextResponse.json(step)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.emailTemplateStep.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
