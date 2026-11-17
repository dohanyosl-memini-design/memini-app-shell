import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** A bejelentkezett felhasználó azonosítója a naplóhoz; null, ha nincs munkamenet. */
export async function sessionActor(): Promise<string | null> {
  const s = await getServerSession(authOptions).catch(() => null)
  return s?.user?.email ?? s?.user?.name ?? null
}
