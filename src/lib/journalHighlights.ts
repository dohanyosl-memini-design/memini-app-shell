/**
 * A napi napló kiemelései — a naplóval együtt eltárolt ténypillanatképből.
 *
 * A napló szövegét az ügynök írja; ezek viszont SZÁMOK, közvetlenül a mentett
 * tényekből. Így a napot egy pillantással is fel lehet mérni, anélkül hogy a
 * narratívát el kellene olvasni — és ami itt látszik, az biztosan igaz, mert
 * nem szövegértelmezésből jön.
 */

export interface Highlight {
  icon: string
  label: string
  tone: 'good' | 'warn' | 'neutral'
}

interface FactsShape {
  ertekesites?: {
    ujRendelesek?: { total?: number }[]
    ujAjanlatok?: unknown[]
    kikuldottAjanlatok?: unknown[]
    mozdultDealek?: unknown[]
  }
  penzugy?: {
    ujSzamlak?: unknown[]
    befizetettSzamlak?: { total?: number }[]
  }
  feladatok?: {
    elvegzett?: unknown[]
    uj?: unknown[]
    lejart?: unknown[]
  }
  kommunikacio?: {
    aktivitasok?: unknown[]
    beerkezettLevelek?: unknown[]
    valaszraVaroSzalak?: unknown[]
  }
  ujKapcsolatok?: { cegek?: unknown[]; kapcsolattartok?: unknown[] }
  tudas?: { lejartNyitottUgyek?: number }
  raktar?: { minimumAlattiTermekek?: number }
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString('de-DE')}`
}

const len = (v: unknown[] | undefined) => v?.length ?? 0

export function journalHighlights(facts: unknown): Highlight[] {
  const f = (facts ?? {}) as FactsShape
  const out: Highlight[] = []

  const orders = f.ertekesites?.ujRendelesek ?? []
  if (orders.length > 0) {
    const sum = orders.reduce((s, o) => s + (o.total ?? 0), 0)
    out.push({
      icon: '📦',
      label: `${orders.length} új rendelés${sum > 0 ? ` · ${eur(sum)}` : ''}`,
      tone: 'good',
    })
  }

  const paid = f.penzugy?.befizetettSzamlak ?? []
  if (paid.length > 0) {
    const sum = paid.reduce((s, i) => s + (i.total ?? 0), 0)
    out.push({ icon: '💶', label: `${paid.length} befolyt számla · ${eur(sum)}`, tone: 'good' })
  }

  const quotesSent = len(f.ertekesites?.kikuldottAjanlatok)
  if (quotesSent > 0) out.push({ icon: '📄', label: `${quotesSent} ajánlat kiküldve`, tone: 'good' })

  const newContacts = len(f.ujKapcsolatok?.cegek) + len(f.ujKapcsolatok?.kapcsolattartok)
  if (newContacts > 0) out.push({ icon: '🤝', label: `${newContacts} új partner / kapcsolat`, tone: 'good' })

  const done = len(f.feladatok?.elvegzett)
  if (done > 0) out.push({ icon: '✅', label: `${done} feladat kész`, tone: 'good' })

  const activities = len(f.kommunikacio?.aktivitasok)
  if (activities > 0) out.push({ icon: '📞', label: `${activities} egyeztetés`, tone: 'neutral' })

  const mails = len(f.kommunikacio?.beerkezettLevelek)
  if (mails > 0) out.push({ icon: '✉️', label: `${mails} beérkezett levél`, tone: 'neutral' })

  // Figyelmeztetések a végére — ezek nem a nap "eredményei", hanem a nyitott vége.
  const overdue = len(f.feladatok?.lejart)
  if (overdue > 0) out.push({ icon: '⏰', label: `${overdue} lejárt feladat`, tone: 'warn' })

  const waiting = len(f.kommunikacio?.valaszraVaroSzalak)
  if (waiting > 0) out.push({ icon: '💬', label: `${waiting} partner vár válaszra`, tone: 'warn' })

  const overdueLoops = f.tudas?.lejartNyitottUgyek ?? 0
  if (overdueLoops > 0) out.push({ icon: '🔗', label: `${overdueLoops} lejárt nyitott ügy`, tone: 'warn' })

  const lowStock = f.raktar?.minimumAlattiTermekek ?? 0
  if (lowStock > 0) out.push({ icon: '📉', label: `${lowStock} termék minimum alatt`, tone: 'warn' })

  return out
}
