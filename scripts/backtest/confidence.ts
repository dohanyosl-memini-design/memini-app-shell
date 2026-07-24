// Determinisztikus confidence-számítás a bizonyíték-gráfból.
//
// Alapelv (a tervezési vitában rögzítve): a confidence NEM a modell érzése,
// hanem számolt mennyiség, és a bizonyíték MINŐSÉGE többet ér a mennyiségénél.
// Öt megjegyzés ugyanattól a partnertől nem ér annyit, mint öt különböző
// partnertől egy-egy.
//
//   supportScore = uniqueCompanyWeight × sourceDiversity × recencyWeight
//   confidence   = supportScore × (1 − contraRatio) × sampleFloor

import type { Hypothesis, Observation } from './types'

export interface ConfidenceBreakdown {
  value: number
  uniqueCompanies: number
  uniqueCompanyWeight: number
  sourceDiversity: number
  recencyWeight: number
  contraRatio: number
  support: number
  contra: number
}

export function computeConfidence(
  hyp: Hypothesis,
  obsById: Map<string, Observation>,
  today: string, // YYYY-MM-DD
): ConfidenceBreakdown {
  const support = hyp.supportingObservationIds
    .map(id => obsById.get(id))
    .filter((o): o is Observation => !!o)
  const contra = hyp.contradictingObservationIds
    .map(id => obsById.get(id))
    .filter((o): o is Observation => !!o)

  // 1) Független források: cégenként számolunk, cég nélküli observation
  //    (általános jel) fél forrásnak számít.
  const companies = new Set(support.filter(o => o.companyId).map(o => o.companyId))
  const orphan = support.filter(o => !o.companyId).length
  const effectiveSources = companies.size + Math.min(orphan, 2) * 0.5
  // Telítődő görbe: 1 forrás ≈ 0.28, 3 ≈ 0.63, 5 ≈ 0.81, 8 ≈ 0.93
  const uniqueCompanyWeight = 1 - Math.exp(-effectiveSources / 3)

  // 2) Forrástípus-diverzitás: ha csak egyetlen csatorna mondja (pl. csak
  //    tasknotesz), gyengébb, mint ha rendelés + aktivitás + memória is.
  //    Az alap 0.7 — az egycsatornás bizonyíték büntetést kap, de nem
  //    éhezteti ki a küszöböt (a mai CRM-adat zöme egyetlen típusból jön).
  const kinds = new Set(support.flatMap(o => o.sourceKinds))
  const sourceDiversity = Math.min(1, 0.7 + 0.15 * (kinds.size - 1))

  // 3) Frissesség: a támogatás mekkora hányada esik az utolsó 30/60 napba.
  const t = Date.parse(today)
  let recencySum = 0
  for (const o of support) {
    const age = (t - Date.parse(o.date)) / 86400000
    recencySum += age <= 30 ? 1 : age <= 60 ? 0.7 : age <= 120 ? 0.4 : 0.2
  }
  const recencyWeight = support.length ? recencySum / support.length : 0

  // 4) Ellenbizonyíték: aránnyal büntet, nem darabszámmal.
  const contraRatio = support.length + contra.length
    ? contra.length / (support.length + contra.length)
    : 0

  // 5) Minta-küszöb: 2-nél kevesebb független forrással a confidence plafonja
  //    0.45 — egyetlen partner hangossága nem minta.
  const sampleFloor = effectiveSources >= 2 ? 1 : 0.45 / Math.max(0.2, uniqueCompanyWeight || 0.2)

  const raw = uniqueCompanyWeight * sourceDiversity * recencyWeight * (1 - contraRatio)
  const value = Math.max(0, Math.min(1, raw * Math.min(1, sampleFloor)))

  return {
    value: Math.round(value * 100) / 100,
    uniqueCompanies: companies.size,
    uniqueCompanyWeight: Math.round(uniqueCompanyWeight * 100) / 100,
    sourceDiversity: Math.round(sourceDiversity * 100) / 100,
    recencyWeight: Math.round(recencyWeight * 100) / 100,
    contraRatio: Math.round(contraRatio * 100) / 100,
    support: support.length,
    contra: contra.length,
  }
}

// Státusz-átmenetek — szintén kód dönt, nem a modell.
// proposed → observed → supported → strong; disproved / expired bárhonnan.
export function nextStatus(
  hyp: Hypothesis,
  cb: ConfidenceBreakdown,
  today: string,
  falsifyMet: boolean,
): Hypothesis['status'] {
  if (hyp.status === 'disproved' || hyp.status === 'expired') return hyp.status
  // A cáfolat elérhető kell legyen: vagy a modell jelezte a falsifyCondition
  // teljesülését, vagy az ellenbizonyíték túlnőtt a támogatáson.
  if (falsifyMet || (cb.contra >= 3 && cb.contra >= cb.support)) return 'disproved'
  if (today > hyp.expiresOn && hyp.status !== 'supported' && hyp.status !== 'strong') return 'expired'
  if (cb.value >= 0.75 && cb.support >= 5 && cb.uniqueCompanies >= 3) return 'strong'
  if (cb.support >= 3 && cb.uniqueCompanies >= 2 && cb.value >= 0.5) return 'supported'
  if (cb.support >= 1) return 'observed'
  return 'proposed'
}

// Megszólalási döntés: mikor éri meg megszakítani Lacit.
// Csak státusz-UGRÁSKOR vagy küszöb ELSŐ átlépésekor, hipotézisenként
// max 3-szor, két megszólalás közt min. 14 nap cooldown.
export function shouldEmit(
  hyp: Hypothesis,
  prevStatus: Hypothesis['status'],
  newStatus: Hypothesis['status'],
  cb: ConfidenceBreakdown,
  today: string,
): { emit: boolean; whyNow: string } {
  if (hyp.emissions >= 3) return { emit: false, whyNow: '' }
  if (hyp.lastEmittedOn) {
    const gap = (Date.parse(today) - Date.parse(hyp.lastEmittedOn)) / 86400000
    if (gap < 14) return { emit: false, whyNow: '' }
  }
  if (newStatus === 'supported' && prevStatus !== 'supported' && prevStatus !== 'strong') {
    return {
      emit: true,
      whyNow: `A(z) ${cb.uniqueCompanies}. független partnernél átlépte a "supported" küszöböt (${cb.support} támogató, ${cb.contra} cáfoló megfigyelés).`,
    }
  }
  if (newStatus === 'strong' && prevStatus !== 'strong') {
    return {
      emit: true,
      whyNow: `A hipotézis "strong" szintre erősödött: confidence ${cb.value}, ${cb.uniqueCompanies} független forrás.`,
    }
  }
  if (newStatus === 'disproved' && hyp.emissions > 0) {
    // Alázat-megszólalás: ha korábban állítottunk valamit, a cáfolatot is kimondjuk.
    return {
      emit: true,
      whyNow: 'Korábban emittált hipotézis megdőlt — a Companion jelzi a saját tévedését.',
    }
  }
  return { emit: false, whyNow: '' }
}
