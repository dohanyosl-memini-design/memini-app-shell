import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.activity.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      type: body.type,
      subject: body.subject || null,
      description: body.description,
      activityDate: body.activityDate ? new Date(body.activityDate) : undefined,
      duration: body.duration ? parseInt(body.duration) : null,
      outcome: body.outcome || null,
    },
  })

  return NextResponse.json(activity)
}
