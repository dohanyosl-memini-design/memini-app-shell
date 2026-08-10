'use client'

import { useState } from 'react'

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

interface DaySchedule { open: string; close: string; closed: boolean }
interface Period { label: string; from: string; until: string; days: (DaySchedule & { day: number })[] }
interface BHours { regular: (DaySchedule & { day: number })[]; periods: Period[] }

function defaultRegular(): BHours['regular'] {
  return DAYS.map((_, day) => ({
    day,
    open: '09:00',
    close: '17:00',
    closed: day >= 5,
  }))
}

function defaultPeriodDays(): Period['days'] {
  return DAYS.map((_, day) => ({ day, open: '09:00', close: '17:00', closed: day >= 5 }))
}

function DayRow({
  d, onChange,
}: { d: DaySchedule & { day: number }; onChange: (v: DaySchedule) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-sm text-gray-600 shrink-0">{DAYS[d.day]}</span>
      <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
        <input
          type="checkbox"
          checked={d.closed}
          onChange={e => onChange({ ...d, closed: e.target.checked })}
          className="accent-blue-600"
        />
        Zárva
      </label>
      {!d.closed && (
        <>
          <input
            type="time"
            value={d.open}
            onChange={e => onChange({ ...d, open: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-28"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="time"
            value={d.close}
            onChange={e => onChange({ ...d, close: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-28"
          />
        </>
      )}
      {d.closed && <span className="text-xs text-gray-400 italic">Zárva</span>}
    </div>
  )
}

const PARTNER_TYPES = [
  'Kastély', 'Vár', 'Kolostor', 'Templom / Dóm', 'Múzeum',
  'Tourist Info', 'Stadtmarketing', 'Hotel / Lobbyshop',
  'Concept Store', 'Ajándékbolt / Souvenirshop',
]

const REGIONS: Record<string, string[]> = {
  DE: [
    'Baden-Württemberg', 'Bajorország', 'Berlin', 'Brandenburg', 'Bréma',
    'Hamburg', 'Hessen', 'Mecklenburg-Elő-Pomeránia', 'Alsó-Szászország',
    'Észak-Rajna-Vesztfália', 'Rajna-vidék-Pfalz', 'Saar-vidék',
    'Szászország', 'Szász-Anhalt', 'Schleswig-Holstein', 'Türingia',
  ],
  AT: [
    'Burgenland', 'Karintia', 'Alsó-Ausztria', 'Felső-Ausztria',
    'Salzburg', 'Stájerország', 'Tirol', 'Vorarlberg', 'Bécs',
  ],
  CH: [
    'Aargau', 'Bern', 'Zürich', 'Genf', 'Luzern', 'St. Gallen',
    'Ticino', 'Valais', 'Vaud', 'Basel-Stadt', 'Basel-Landschaft',
    'Solothurn', 'Freiburg', 'Neuenburg', 'Jura', 'Schaffhausen',
    'Thurgau', 'Graubünden', 'Glarus', 'Appenzell', 'Uri', 'Schwyz',
    'Obwalden', 'Nidwalden', 'Zug',
  ],
  IT: [
    'Lombardia', 'Veneto', 'Piemont', 'Toszkána', 'Lazio', 'Szicília',
    'Campania', 'Emilia-Romagna', 'Trentino-Alto Adige', 'Puglia',
    'Liguria', 'Umbria', 'Marche', 'Abruzzo', 'Friuli-Venezia Giulia',
    'Calabria', 'Szardínia', 'Basilicata', 'Molise', "Valle d'Aosta",
  ],
  FR: [
    'Île-de-France', 'Auvergne-Rhône-Alpes', 'Nouvelle-Aquitaine',
    'Occitanie', "Provence-Alpes-Côte d'Azur", 'Grand Est',
    'Hauts-de-France', 'Normandie', 'Bretagne', 'Bourgogne-Franche-Comté',
    'Centre-Val de Loire', 'Pays de la Loire', 'Corse',
  ],
  HU: [
    'Budapest', 'Baranya', 'Bács-Kiskun', 'Békés', 'Borsod-Abaúj-Zemplén',
    'Csongrád-Csanád', 'Fejér', 'Győr-Moson-Sopron', 'Hajdú-Bihar',
    'Heves', 'Jász-Nagykun-Szolnok', 'Komárom-Esztergom', 'Nógrád',
    'Pest', 'Somogy', 'Szabolcs-Szatmár-Bereg', 'Tolna', 'Vas',
    'Veszprém', 'Zala',
  ],
}

const COUNTRIES = [
  { code: 'DE', label: 'Németország' },
  { code: 'AT', label: 'Ausztria' },
  { code: 'CH', label: 'Svájc' },
  { code: 'IT', label: 'Olaszország' },
  { code: 'FR', label: 'Franciaország' },
  { code: 'HU', label: 'Magyarország' },
]

const CHANNELS = [
  'Hideg megkeresés', 'Személyes találkozó', 'Kiállítás / vásár',
  'Ajánlás', 'Weboldalról érdeklődött',
]

const LANGUAGES = [
  { code: 'DE', label: 'Német' },
  { code: 'EN', label: 'Angol' },
  { code: 'HU', label: 'Magyar' },
  { code: 'MULTI', label: 'Többnyelvű' },
]

// A legördülőben csak az AKTÍV állapotok szerepelnek — a temetőbe helyezés a
// kuka gombon át megy (kötelező indokkal), nem itt.
const LIFECYCLE_OPTIONS = [
  { value: 'prospect',   label: 'Prospekt — nem tud rólunk' },
  { value: 'cold_lead',  label: 'Hideg lead — megkeresve, nincs válasz' },
  { value: 'warm_lead',  label: 'Meleg lead — feliratkozott, sorozatot kap' },
  { value: 'interested', label: 'Érdeklődő — visszajelzett' },
  { value: 'partner',    label: 'Partner — rendelt' },
  { value: 'inactive',   label: 'Inaktív — partner, de csendes' },
]

interface Company {
  id: string
  name: string
  lifecycle?: string | null
  partnerType?: string | null
  industry?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  zip?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  vatId?: string | null
  customerNumber?: string | null
  classification?: string | null
  language?: string | null
  channel?: string | null
  notes?: string | null
  businessHours?: BHours | null
}

interface CompanyFormProps {
  company: Company | null
  onSave: () => void
  onCancel: () => void
}

export default function CompanyForm({ company, onSave, onCancel }: CompanyFormProps) {
  const [loading, setLoading] = useState(false)
  const existingBH = company?.businessHours as BHours | null | undefined
  const [bh, setBh] = useState<BHours>({
    regular: existingBH?.regular ?? defaultRegular(),
    periods: existingBH?.periods ?? [],
  })
  const [lifecycle, setLifecycle] = useState(company?.lifecycle || 'prospect')
  const [form, setForm] = useState({
    name: company?.name || '',
    partnerType: company?.partnerType || '',
    industry: company?.industry || '',
    website: company?.website || '',
    phone: company?.phone || '',
    email: company?.email || '',
    address: company?.address || '',
    zip: company?.zip || '',
    city: company?.city || '',
    region: company?.region || '',
    country: company?.country || 'DE',
    vatId: company?.vatId || '',
    customerNumber: company?.customerNumber || '',
    classification: company?.classification || 'D',
    language: company?.language || 'DE',
    channel: company?.channel || '',
    notes: company?.notes || '',
  })

  const regions = REGIONS[form.country] || []

  function setCountry(c: string) {
    setForm({ ...form, country: c, region: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const method = company ? 'PUT' : 'POST'
    const url = company ? `/api/companies/${company.id}` : '/api/companies'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      // Új cégnél a lifecycle-t a POST is elfogadja; meglévőnél külön, a
      // védett lifecycle-végponton át állítjuk (naplózással), ezért innen kihagyjuk.
      body: JSON.stringify({ ...form, businessHours: bh, ...(company ? {} : { lifecycle }) }),
    })

    // Meglévő cég életciklusa csak akkor változik, ha tényleg más lett — így a
    // lifecycle-napló nem telik meg üres bejegyzésekkel. Az aktív állapotok közti
    // váltáshoz nem kell indok, ezért a PATCH gond nélkül lefut.
    if (company && lifecycle !== (company.lifecycle || 'prospect')) {
      await fetch(`/api/companies/${company.id}/lifecycle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: lifecycle }),
      })
    }

    setLoading(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[78vh] overflow-y-auto pr-1">
      {/* Azonosítás */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alapadatok</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cégnév *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner típus</label>
              <select
                value={form.partnerType}
                onChange={(e) => setForm({ ...form, partnerType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Válassz...</option>
                {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Besorolás (ABC)</label>
              <select
                value={form.classification}
                onChange={(e) => setForm({ ...form, classification: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="A">A – Kiemelt</option>
                <option value="B">B – Rendszeres</option>
                <option value="C">C – Alkalmi</option>
                <option value="D">D – Potenciális</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Elérhetőség */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Elérhetőség</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weboldal</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="pl. schloss-beispiel.de"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Cím */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cím</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utca, házszám</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ország</label>
              <select
                value={form.country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Régió / Tartomány</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Válassz...</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="89073"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adószám (USt-IdNr.)</label>
              <input
                type="text"
                value={form.vatId}
                onChange={(e) => setForm({ ...form, vatId: e.target.value })}
                placeholder="DE123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunden-Nr.</label>
              <input
                type="text"
                value={form.customerNumber}
                onChange={(e) => setForm({ ...form, customerNumber: e.target.value })}
                placeholder="pl. 0010"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CRM adatok */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">CRM adatok</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Életciklus — hol tart a lépcsőn
            </label>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              {/* Ha a cég épp a temetőben van, mutatjuk az aktuális állapotot is,
                  hogy a legördülő ne ugorjon váratlanul másikra. */}
              {lifecycle && !LIFECYCLE_OPTIONS.some((o) => o.value === lifecycle) && (
                <option value={lifecycle}>Jelenlegi: {lifecycle}</option>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Közvetlenül a helyes fokra állíthatod. Az „elvesztett" a kuka gombon át megy, indokkal.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kommunikáció nyelve</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Honnan jött (csatorna)</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nincs megadva</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Nyitvatartás */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Nyitvatartás</p>

        {/* Reguláris heti nyitvatartás */}
        <div className="space-y-2 mb-4">
          {bh.regular.map(d => (
            <DayRow
              key={d.day}
              d={d}
              onChange={v => setBh(prev => ({
                ...prev,
                regular: prev.regular.map(r => r.day === d.day ? { ...v, day: d.day } : r),
              }))}
            />
          ))}
        </div>

        {/* Időszakos nyitvatartások */}
        {bh.periods.length > 0 && (
          <div className="space-y-4 mb-3">
            {bh.periods.map((p, pi) => (
              <div key={pi} className="border border-blue-200 rounded-lg p-3 bg-blue-50/40">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Időszak neve (pl. Nyári nyitvatartás)"
                    value={p.label}
                    onChange={e => setBh(prev => ({
                      ...prev,
                      periods: prev.periods.map((pp, i) => i === pi ? { ...pp, label: e.target.value } : pp),
                    }))}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setBh(prev => ({ ...prev, periods: prev.periods.filter((_, i) => i !== pi) }))}
                    className="text-red-400 hover:text-red-600 text-sm px-2"
                  >
                    Törlés
                  </button>
                </div>
                <div className="flex gap-2 items-center mb-3">
                  <span className="text-xs text-gray-500 shrink-0">Érvényes:</span>
                  <input
                    type="date"
                    value={p.from}
                    onChange={e => setBh(prev => ({
                      ...prev,
                      periods: prev.periods.map((pp, i) => i === pi ? { ...pp, from: e.target.value } : pp),
                    }))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <input
                    type="date"
                    value={p.until}
                    onChange={e => setBh(prev => ({
                      ...prev,
                      periods: prev.periods.map((pp, i) => i === pi ? { ...pp, until: e.target.value } : pp),
                    }))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-2">
                  {p.days.map(d => (
                    <DayRow
                      key={d.day}
                      d={d}
                      onChange={v => setBh(prev => ({
                        ...prev,
                        periods: prev.periods.map((pp, i) => i === pi
                          ? { ...pp, days: pp.days.map(dd => dd.day === d.day ? { ...v, day: d.day } : dd) }
                          : pp
                        ),
                      }))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setBh(prev => ({
            ...prev,
            periods: [...prev.periods, { label: '', from: '', until: '', days: defaultPeriodDays() }],
          }))}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Időszakos nyitvatartás hozzáadása
        </button>
      </div>

      <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white py-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Mégse
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </form>
  )
}
