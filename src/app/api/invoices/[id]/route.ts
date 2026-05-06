import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      company: true,
      items: { include: { product: true } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  if (body.status) {
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: body.status,
        paidAt: body.status === 'paid' ? new Date() : null,
      },
      include: { contact: true, company: true, items: true },
    })
    return NextResponse.json(invoice)
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await prisma.invoice.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
