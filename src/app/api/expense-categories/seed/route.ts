import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_CATEGORIES = [
  { name: 'Termékköltség',         color: '#EF4444', sortOrder: 1 },
  { name: 'Alapanyag',             color: '#F97316', sortOrder: 2 },
  { name: 'Gyártás',               color: '#F59E0B', sortOrder: 3 },
  { name: 'Munkabér',              color: '#EAB308', sortOrder: 4 },
  { name: 'Marketing',             color: '#84CC16', sortOrder: 5 },
  { name: 'Szoftver & App-ok',     color: '#06B6D4', sortOrder: 6 },
  { name: 'Tárhely',               color: '#3B82F6', sortOrder: 7 },
  { name: 'Könyvelés',             color: '#6366F1', sortOrder: 8 },
  { name: 'Irodai kellékek',       color: '#8B5CF6', sortOrder: 9 },
  { name: 'Utazás & Üzemanyag',    color: '#EC4899', sortOrder: 10 },
  { name: 'Autóköltség',           color: '#F43F5E', sortOrder: 11 },
  { name: 'Szállítás (kimenő)',    color: '#14B8A6', sortOrder: 12 },
  { name: 'Bankköltség',           color: '#64748B', sortOrder: 13 },
  { name: 'Biztosítás',            color: '#475569', sortOrder: 14 },
  { name: 'Kommunikáció',          color: '#0EA5E9', sortOrder: 15 },
  { name: 'Javítás & Karbantartás', color: '#78716C', sortOrder: 16 },
  { name: 'Egyéb',                 color: '#6B7280', sortOrder: 17 },
]

export async function POST() {
  const existing = await prisma.expenseCategory.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(c => c.name))

  const toCreate = DEFAULT_CATEGORIES.filter(c => !existingNames.has(c.name))
  if (toCreate.length > 0) {
    await prisma.expenseCategory.createMany({ data: toCreate })
  }

  const all = await prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ created: toCreate.length, total: all.length, categories: all })
}
