import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const year = new Date().getFullYear()
  const last = await prisma.deliveryNote.findFirst({
    where: { number: { endsWith: `/${year}` } },
    orderBy: { createdAt: 'desc' },
  })
  const lastNum = last ? parseInt(last.number.replace('SL-', '').split('/')[0] || '0') : 0
  const number = `SL-${String(lastNum + 1).padStart(2, '0')}/${year}`
  return NextResponse.json({ number })
}
