import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const year = new Date().getFullYear()
  const lastInvoice = await prisma.invoice.findFirst({
    where: { number: { endsWith: `/${year}` }, stornoOf: null },
    orderBy: { createdAt: 'desc' },
  })
  const lastNum = lastInvoice ? parseInt(lastInvoice.number.split('/')[0] || '0') : 0
  const number = `${String(lastNum + 1).padStart(2, '0')}/${year}`
  return NextResponse.json({ number })
}
