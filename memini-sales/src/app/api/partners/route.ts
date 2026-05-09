import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, city: true, country: true, email: true, phone: true },
  })

  return NextResponse.json({ partners: companies })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { companyName, firstName, lastName, email, phone, city, country, notes } = body

  if (!companyName && !lastName) {
    return NextResponse.json({ error: 'Cég neve vagy kontaktnév kötelező' }, { status: 400 })
  }

  let company = null
  if (companyName) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        city: city || null,
        country: country || 'DE',
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        classification: 'D',
      },
    })
  }

  let contact = null
  if (firstName || lastName) {
    contact = await prisma.contact.create({
      data: {
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || null,
        phone: phone || null,
        status: 'lead',
        notes: notes || null,
        companyId: company?.id || null,
      },
    })
  }

  return NextResponse.json({ company, contact }, { status: 201 })
}
