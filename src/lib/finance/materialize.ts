/**
 * Dokumentumból CRM-rekord: bejövő számla/nyugta → Expense (Könyvelés), kimenő számla → Invoice
 * (Számlák). Az import (egyből rögzít) és a jóváhagyás is ezt használja, így a kettő nem térhet el.
 *
 * Alapelvek: meglévő rekordot nem írunk felül; ami nem biztos (hiányzó adat, foglalt számlaszám,
 * már létező hasonló költség), azt nem találgatjuk, hanem `blocked`-ként visszaadjuk — az emberi
 * ellenőrzési sorba kerül.
 */

import type { Prisma, PrismaClient, FinancialDocument } from '@prisma/client'
import { normalizeName, normalizeVatId } from './dedupe'

export type Db = Pick<PrismaClient, 'expense' | 'invoice' | 'company'>

const EXPENSE_KINDS = ['incoming_invoice', 'receipt']

export type Plan =
  | { type: 'expense'; data: Prisma.ExpenseCreateInput; notes: string[] }
  | { type: 'invoice'; data: Prisma.InvoiceUncheckedCreateInput; notes: string[]; companyId: string | null }
  | { type: 'none'; notes: string[] }
  | { type: 'blocked'; code: 'MISSING_FIELDS' | 'SIMILAR_EXPENSE' | 'INVOICE_NUMBER_EXISTS'; reason: string }

/** Az Expense/Invoice három összege; csak pontos számtannal pótol, találgatás nélkül. */
export function expenseAmounts(d: Pick<FinancialDocument, 'netCents' | 'vatCents' | 'grossCents'>): { net: number; vat: number; gross: number; derived: string | null } | null {
  const { netCents: n, vatCents: v, grossCents: g } = d
  if (n != null && v != null && g != null) return { net: n, vat: v, gross: g, derived: null }
  if (n != null && g != null) return { net: n, vat: g - n, gross: g, derived: 'ÁFA = bruttó − nettó (a dokumentumon nem szerepelt külön)' }
  if (v != null && g != null) return { net: g - v, vat: v, gross: g, derived: 'nettó = bruttó − ÁFA (a dokumentumon nem szerepelt külön)' }
  return null
}

type Extra = { payment_status?: string; paid_date?: string }
const extraOf = (d: FinancialDocument): Extra => (d.sourceData && typeof d.sourceData === 'object' && !Array.isArray(d.sourceData) ? (d.sourceData as Extra) : {})

/** A CRM-beli cég a vevő adószáma, ennek híján a (normalizált) neve alapján; kétes egyezésnél nem köt. */
export async function matchCompany(db: Pick<PrismaClient, 'company'>, vatId: string | null, name: string | null): Promise<{ id: string | null; note: string | null }> {
  const companies = await db.company.findMany({ select: { id: true, name: true, vatId: true }, take: 20000 })
  const v = normalizeVatId(vatId)
  if (v) {
    const hit = companies.filter((c) => normalizeVatId(c.vatId) === v)
    if (hit.length === 1) return { id: hit[0].id, note: null }
    if (hit.length > 1) return { id: null, note: 'Több cégnek is ez az adószáma, ezért a számla partner nélkül rögzült.' }
  }
  const n = normalizeName(name)
  if (n) {
    const hit = companies.filter((c) => normalizeName(c.name) === n)
    if (hit.length === 1) return { id: hit[0].id, note: null }
    if (hit.length > 1) return { id: null, note: `Több azonos nevű cég is van (${name}), ezért a számla partner nélkül rögzült.` }
  }
  return { id: null, note: `A vevő (${name ?? 'ismeretlen'}) nem található a CRM-ben, a számla partner nélkül rögzült. A partnerhez később köthető.` }
}

export async function planMaterialization(
  doc: FinancialDocument, db: Db, opts: { confirmDistinct?: boolean; who: string },
): Promise<Plan> {
  if (doc.expenseId || doc.invoiceId) return { type: 'none', notes: ['Ehhez a dokumentumhoz már tartozik rögzített rekord.'] }

  // ── Bejövő költség → Könyvelés ──
  if (EXPENSE_KINDS.includes(doc.kind) && doc.direction !== 'outgoing') {
    if (doc.currency !== 'EUR') {
      return { type: 'none', notes: [`A pénznem ${doc.currency ?? 'ismeretlen'}, nem EUR: a költség nem került át a Könyvelésbe, mert az EUR-érték számítását nem találgatjuk. Rögzítsd kézzel a Könyvelés oldalon.`] }
    }
    const amts = expenseAmounts(doc)
    const missing = [!doc.issueDate && 'kiállítás dátuma', !doc.issuerName && 'kibocsátó neve', !amts && 'összegek (legalább a bruttó és a nettó vagy az ÁFA)'].filter(Boolean)
    if (missing.length || !amts) return { type: 'blocked', code: 'MISSING_FIELDS', reason: `A költség rögzítéséhez hiányzik: ${missing.join(', ')}. Javítsd az adatot a szerkesztésnél.` }

    if (!opts.confirmDistinct) {
      // Egy már a Könyvelésben szereplő hasonló költség (pl. korábban kézzel rögzítve) dupla tételt okozna.
      const vendor = { equals: doc.issuerName as string, mode: 'insensitive' as const }
      const similar = await db.expense.findMany({
        where: { OR: [
          ...(doc.externalNumber ? [{ vendor, reference: doc.externalNumber }] : []),
          { vendor, date: doc.issueDate as Date, totalAmount: amts.gross / 100 },
        ] },
        select: { vendor: true, date: true, totalAmount: true, reference: true }, take: 3,
      })
      if (similar.length) {
        const list = similar.map((e) => `${e.vendor} ${e.reference ?? ''} ${e.totalAmount} (${e.date.toISOString().slice(0, 10)})`).join('; ')
        return { type: 'blocked', code: 'SIMILAR_EXPENSE', reason: `A Könyvelésben már van hasonló költség: ${list}. Igazold, hogy különálló tétel, különben dupla tétel keletkezne.` }
      }
    }
    return {
      type: 'expense',
      notes: amts.derived ? [amts.derived] : [],
      data: {
        date: doc.issueDate as Date, vendor: doc.issuerName as string,
        description: `${doc.kind === 'receipt' ? 'Nyugta' : 'Számla'} ${doc.externalNumber ?? doc.originalFilename}`,
        amount: amts.net / 100, vatAmount: amts.vat / 100, totalAmount: amts.gross / 100,
        currency: 'EUR', reference: doc.externalNumber, status: 'verified',
        receiptUrl: doc.storageUrl ? `/api/finance/documents/${doc.id}/original` : null,
        notes: `Importált bizonylat (${doc.id}), ${opts.who}${amts.derived ? `; ${amts.derived}` : ''}`,
      },
    }
  }

  // ── Kimenő számla → Számlák ──
  if (doc.kind === 'outgoing_invoice') {
    const amts = expenseAmounts(doc)
    const missing = [!doc.externalNumber && 'számlaszám', !doc.issueDate && 'kiállítás dátuma', !doc.currency && 'pénznem', !amts && 'összegek (legalább a bruttó és a nettó vagy az ÁFA)'].filter(Boolean)
    if (missing.length || !amts) return { type: 'blocked', code: 'MISSING_FIELDS', reason: `A számla rögzítéséhez hiányzik: ${missing.join(', ')}. Javítsd az adatot a szerkesztésnél.` }
    const number = doc.externalNumber as string
    // A hiteles számlaszám az eredeti; a CRM meglévő számát nem írjuk felül és nem duplázzuk.
    if (await db.invoice.findUnique({ where: { number }, select: { id: true } })) {
      return { type: 'blocked', code: 'INVOICE_NUMBER_EXISTS', reason: `A(z) ${number} számlaszám már szerepel a Számlák között; a meglévőt nem írom felül. Töröld vagy egyeztesd a meglévőt, majd rögzítsd újra.` }
    }
    const partner = await matchCompany(db, doc.recipientVatId, doc.recipientName)
    const extra = extraOf(doc)
    const paid = extra.payment_status === 'paid'
    const paidAt = paid ? (extra.paid_date ? new Date(`${extra.paid_date}T12:00:00Z`) : (doc.issueDate as Date)) : null
    const vatRate = amts.net !== 0 ? Math.round(Math.abs(amts.vat / amts.net) * 1000) / 10 : 0
    const notes = [...(amts.derived ? [amts.derived] : []), ...(partner.note ? [partner.note] : [])]
    return {
      type: 'invoice', companyId: partner.id, notes,
      data: {
        number, date: doc.issueDate as Date, dueDate: (doc.dueDate ?? doc.issueDate) as Date,
        status: paid ? 'paid' : 'open', paidAt,
        notes: `Importált bizonylat (${doc.id}), ${opts.who}. A tételek az eredeti dokumentumon találhatók (${doc.originalFilename}).`,
        billingName: doc.recipientName, companyId: partner.id, currency: doc.currency as string,
        subtotal: amts.net / 100, vatAmount: amts.vat / 100, total: amts.gross / 100,
        items: { create: [{ description: `Importált számla — a tételek az eredeti dokumentumon (${doc.originalFilename})`, quantity: 1, unitPrice: amts.net / 100, vatRate, total: amts.gross / 100, isDiscount: false }] },
      },
    }
  }

  return { type: 'none', notes: ['Ez a típus (jóváírás, sztornó, helyesbítő, bankkivonat stb.) csak a dokumentumtárban rögzül, a Könyvelés/Számlák táblákba nem kerül át automatikusan.'] }
}

/** A terv végrehajtása (tranzakción belül hívandó). */
export async function executePlan(tx: Db, plan: Plan): Promise<{ expenseId: string | null; invoiceId: string | null }> {
  if (plan.type === 'expense') return { expenseId: (await tx.expense.create({ data: plan.data })).id, invoiceId: null }
  if (plan.type === 'invoice') return { expenseId: null, invoiceId: (await tx.invoice.create({ data: plan.data })).id }
  return { expenseId: null, invoiceId: null }
}
