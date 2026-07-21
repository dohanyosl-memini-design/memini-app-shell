// Márkahangú tartalom-generálás (V1) — a beépített "Generálás" gomb közös
// motorja. Két üzemmód:
//   generate/derive: forrásból (ötlet, téma-vázlat, szülő-tartalom) egy adott
//                    csatornára + nyelvre gyárt tartalmat
//   localize:        meglévő szöveget másik nyelvre lokalizál (nem gépi
//                    fordítás — márkahang megtartásával, piacra igazítva)
// A Memini márkahang részletei a memini-brand skillből jönnek; itt egy tömör
// kivonat a rendszer-promptban, hogy a felületi generálás önállóan is működjön.

import Anthropic from '@anthropic-ai/sdk'
import { channelInfo, LANGUAGES } from './marketingConstants'

const MODEL = 'claude-sonnet-4-6'

const BRAND = `A Memini Design egy B2B souvenir- és hűtőmágnes-gyártó, amely német
ajándékboltoknak, múzeumoknak, váraknak, katedrálisoknak, kolostoroknak és
turisztikai helyszíneknek értékesít. Hangnem: meleg, szakmai, minőség- és
kézművesség-központú, sosem tolakodó. Elsődleges piac: Németország (német
logika). A tartalom mindig a helyszín/partner értékét és a látogatói élményt
helyezi előtérbe, nem az árat.`

const CHANNEL_RULES: Record<string, string> = {
  blog:       'Hosszabb blogcikk (kb. 600–1000 szó), címmel és alcímekkel tagolva, SEO-tudatosan, természetes kulcsszavakkal. Bevezető, kifejtés részekre bontva, lezárás halk CTA-val.',
  linkedin:   'LinkedIn-poszt (kb. 150–300 szó): erős horog az első sorban, egy világos gondolat/érték, rövid bekezdések, 1 halk CTA, max. 3 releváns hashtag.',
  facebook:   'Facebook-poszt (kb. 80–150 szó): közvetlen, közösségi hangnem, egy gondolat, kérdés vagy felhívás a végén.',
  instagram:  'Instagram-képaláírás: rövid, vizuális, 1–2 emoji, erős első sor, a végén 5–10 releváns hashtag külön blokkban.',
  newsletter: 'Hírlevél: tárgysor (SUBJECT: sorral kezdve), majd személyes, értékadó törzsszöveg, egy világos CTA.',
  pinterest:  'Pinterest-leírás: rövid, kulcsszó-gazdag, a keresésre optimalizált, 1–2 mondat + pár hashtag.',
}

const LANG_NAME: Record<string, string> = { de: 'német', hu: 'magyar', en: 'angol' }

export interface GenerateInput {
  mode: 'generate' | 'localize'
  channel: string
  language: string          // de | hu | en
  sourceText: string        // ötlet/vázlat/szülő-body (generate) vagy a forrás-body (localize)
  title?: string            // opcionális kontextus-cím
  extraInstruction?: string // szabad utasítás (pl. "játékosabban")
  brandNotes?: string       // opcionális extra márka-kontextus a hívótól
}

export interface GenerateResult {
  text: string
  model: string
}

export function buildSystemPrompt(input: GenerateInput): string {
  const ch = channelInfo(input.channel)
  const langName = LANG_NAME[input.language] ?? input.language
  const channelRule = CHANNEL_RULES[input.channel] ?? 'Rövid, márkahű tartalom.'

  const base = `${BRAND}${input.brandNotes ? `\n\nTovábbi márka-kontextus:\n${input.brandNotes}` : ''}

Csatorna: ${ch?.label ?? input.channel}. ${channelRule}
Nyelv: ${langName}. A szöveget NATÍV ${langName} nyelven írd — ne fordítást, hanem az adott piacra igazított, természetes szöveget.`

  if (input.mode === 'localize') {
    return `${base}

Feladat: a megadott forrásszöveget ültesd át ${langName} nyelvre a Memini márkahangjának megtartásával. Ez lokalizáció, nem szó szerinti fordítás — igazítsd a célpiac elvárásaihoz, de a mondanivaló és a szerkezet maradjon.
Csak a kész szöveget add vissza, magyarázat nélkül.`
  }

  return `${base}

Feladat: a megadott forrás (téma, vázlat vagy alap-tartalom) alapján készíts kész, publikálható ${ch?.label ?? input.channel} tartalmat a fenti szabályok szerint.
Csak a kész szöveget add vissza, magyarázat nélkül.`
}

export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')
  if (!LANGUAGES.some(l => l.key === input.language)) throw new Error(`Ismeretlen nyelv: ${input.language}`)

  const client = new Anthropic({ apiKey })
  const userParts = [
    input.title ? `Cím / kontextus: ${input.title}` : '',
    input.extraInstruction ? `Külön kérés: ${input.extraInstruction}` : '',
    '',
    input.mode === 'localize' ? 'Forrásszöveg:' : 'Forrás (téma / vázlat / alap-tartalom):',
    input.sourceText,
  ].filter(Boolean).join('\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: input.channel === 'blog' ? 4096 : 1500,
    system: buildSystemPrompt(input),
    messages: [{ role: 'user', content: userParts }],
  })

  const block = response.content.find(b => b.type === 'text')
  const text = block?.type === 'text' ? block.text.trim() : ''
  return { text, model: MODEL }
}
