// Dátum/idő segédek — kliens és szerver oldalon egyaránt használható.
// A feladat-határidő lehet csak nap (éjfél UTC) vagy pontos időpont.

const BUSINESS_TZ = 'Europe/Budapest'

// Van-e a dátumnak érdemi napon belüli ideje (nem éjfél-UTC = nem "csak nap").
export function dueHasTime(d: Date): boolean {
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0
}

/**
 * MCP/agent bemenet feloldása Date-té:
 *  - "YYYY-MM-DD"                    → csak nap (éjfél UTC)
 *  - explicit időzónás ISO (…Z/+hh) → ahogy van
 *  - "YYYY-MM-DDTHH:mm[:ss]"         → Europe/Budapest helyi idő szerint értelmezve
 * Így ha az agent "14:30"-at mond, az a magyar/német (CET/CEST) fali óra szerint kerül be.
 */
export function parseDueInput(s: string | null | undefined): Date | null {
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s) // csak nap → éjfél UTC
  if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s) // explicit időzóna

  // Helyi idő időzóna nélkül → Europe/Budapest-ként értelmezzük.
  const asUtc = new Date(s.endsWith('Z') ? s : `${s}Z`)
  if (isNaN(asUtc.getTime())) return new Date(s)
  const bpWall = new Date(asUtc.toLocaleString('en-US', { timeZone: BUSINESS_TZ }))
  const offset = bpWall.getTime() - asUtc.getTime()
  return new Date(asUtc.getTime() - offset)
}
