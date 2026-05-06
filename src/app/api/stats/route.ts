import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    wonRevenue,
    dealsByStage,
    recentContacts,
    contactsByStatus,
    allDeals,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.count(),
    prisma.task.count({ where: { status: { not: 'completed' } } }),
    prisma.deal.aggregate({ where: { stage: 'closed_won' }, _sum: { value: true } }),
    prisma.deal.groupBy({ by: ['stage'], _count: true, _sum: { value: true } }),
    prisma.contact.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { company: true },
    }),
    prisma.contact.groupBy({ by: ['status'], _count: true }),
    prisma.deal.findMany({
      select: { value: true, stage: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const upcomingTasks = await prisma.task.findMany({
    where: {
      status: { not: 'completed' },
      dueDate: { gte: new Date() },
    },
    take: 5,
    orderBy: { dueDate: 'asc' },
    include: { contact: true },
  })

  return NextResponse.json({
    totalContacts,
    totalCompanies,
    totalDeals,
    pendingTasks,
    wonRevenue: wonRevenue._sum.value || 0,
    dealsByStage,
    recentContacts,
    contactsByStatus,
    allDeals,
    upcomingTasks,
  })
}
