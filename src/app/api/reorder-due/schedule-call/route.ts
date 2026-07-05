import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reorderCallTaskTitle, FULFILLED_ORDER_STATUSES } from '@/lib/reorderDue'

export const dynamic = 'force-dynamic'

// "Hívás ütemezése" akció: feladatot hoz létre a partnerhez, a cégnévvel és az
// utolsó teljesített rendelés dátumával a címben.
// POST /api/reorder-due/schedule-call  { companyId, dueDate?, priority? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { companyId?: string; dueDate?: string; priority?: string }
  if (!body.companyId) {
    return NextResponse.json({ error: 'companyId kötelező.' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({
    where: { id: body.companyId },
    select: { id: true, name: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Cég nem található.' }, { status: 404 })
  }

  const lastOrder = await prisma.order.findFirst({
    where: { companyId: company.id, status: { in: FULFILLED_ORDER_STATUSES } },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  const task = await prisma.task.create({
    data: {
      title: reorderCallTaskTitle(company.name, lastOrder?.date ?? null),
      description: 'Reorder-hívás — a partner régóta nem rendelt, egyeztetés a következő rendelésről.',
      dueDate:  body.dueDate ? new Date(body.dueDate) : null,
      priority: body.priority || 'medium',
      status:   'pending',
      taskType: 'call',
      companyId: company.id,
    },
    include: { company: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ok: true, task }, { status: 201 })
}
