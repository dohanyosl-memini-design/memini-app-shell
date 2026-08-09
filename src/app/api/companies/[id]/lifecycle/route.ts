import { NextRequest, NextResponse } from 'next/server'
import { transitionCompany, LifecycleError, LIFECYCLE_STATES } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'

// Cég életciklus-léptetése. Elvesztettbe csak kötelező indokkal (a lifecycle
// réteg érvényesíti). A megengedett átmeneteket is a réteg dönti el.
//   PATCH body: { to: LifecycleState, reason?: string }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let body: { to?: string; reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hiányzó vagy hibás kérés-törzs.' }, { status: 400 })
  }

  const to = body.to
  if (!to || !(LIFECYCLE_STATES as readonly string[]).includes(to)) {
    return NextResponse.json({ error: `Ismeretlen célállapot: ${to}` }, { status: 400 })
  }

  try {
    const result = await transitionCompany({
      companyId: params.id,
      to,
      reason: body.reason,
      source: 'ui',
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof LifecycleError) {
      const status =
        e.code === 'reason_required' ? 400 :
        e.code === 'not_found' ? 404 :
        e.code === 'invalid_transition' || e.code === 'invalid_state' ? 409 : 400
      return NextResponse.json({ error: e.message, code: e.code }, { status })
    }
    throw e
  }
}
