'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit2, Upload, Camera, RefreshCw, TrendingDown, TrendingUp, RepeatIcon, X, Check, AlertCircle } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'

interface Expense {
  id: string
  date: string
  vendor: string
  description: string
  amount: number
  currency: string
  vatAmount: number
  category: string | null
  receiptUrl: string | null
  reference: string | null
}

interface RecurringExpense {
  id: string
  name: string
  vendor: string | null
  amount: number
  currency: string
  category: string | null
  frequency: string
  nextDue: string
  active: boolean
  notes: string | null
}

interface Invoice {
  id: string
  number: string
  date: string
  total: number
  status: string
  company: { name: string } | null
}

const CATEGORIES = [
  'Irodaszer', 'Szállítás', 'Marketing', 'Szoftver / Előfizetés', 'Nyomtatás',
  'Csomagolóanyag', 'Alapanyag', 'Közüzemi díj', 'Bank / Pénzügyi díj',
  'Könyvelő', 'Egyéb',
]

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Heti', monthly: 'Havi', quarterly: 'Negyedéves', yearly: 'Éves',
}

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const EMPTY_FORM = {
  date: format(new Date(), 'yyyy-MM-dd'),
  vendor: '', description: '', amount: '', vatAmount: '',
  currency: 'EUR', category: '', reference: '',
}

export default function BookkeepingPage() {
  const [tab, setTab] = useState<'expenses' | 'recurring' | 'summary'>('expenses')
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // New expense modal
  const [showModal, setShowModal] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  // Recurring modal
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [editRecurring, setEditRecurring] = useState<RecurringExpense | null>(null)
  const [recForm, setRecForm] = useState({
    name: '', vendor: '', amount: '', currency: 'EUR', category: '',
    frequency: 'monthly', startDate: format(new Date(), 'yyyy-MM-dd'),
    nextDue: format(new Date(), 'yyyy-MM-dd'), notes: '',
  })

  // OCR state
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const monthKey = format(selectedMonth, 'yyyy-MM')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [expRes, recRes, invRes] = await Promise.all([
      fetch(`/api/expenses?month=${monthKey}`),
      fetch('/api/recurring-expenses'),
      fetch(`/api/invoices?status=paid`),
    ])
    const [expData, recData, invData] = await Promise.all([
      expRes.json(), recRes.json(), invRes.json(),
    ])
    setExpenses(expData)
    setRecurring(recData)
    setInvoices(invData.filter((inv: Invoice) => inv.date?.startsWith(monthKey)))
    setLoading(false)
  }, [monthKey])

  useEffect(() => { fetchData() }, [fetchData])

  function openNew() {
    setEditExpense(null)
    setForm(EMPTY_FORM)
    setScanResult(null)
    setShowModal(true)
  }

  function openEdit(exp: Expense) {
    setEditExpense(exp)
    setForm({
      date: exp.date.slice(0, 10),
      vendor: exp.vendor,
      description: exp.description,
      amount: String(exp.amount),
      vatAmount: String(exp.vatAmount),
      currency: exp.currency,
      category: exp.category || '',
      reference: exp.reference || '',
    })
    setShowModal(true)
  }

  async function handleSaveExpense() {
    const body = { ...form, amount: Number(form.amount), vatAmount: Number(form.vatAmount || 0) }
    if (editExpense) {
      await fetch(`/api/expenses/${editExpense.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setShowModal(false)
    fetchData()
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Törlöd ezt a kiadást?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  async function handleScanFile(file: File) {
    setScanning(true)
    setScanResult(null)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type || 'image/jpeg'
      const res = await fetch('/api/expenses/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()
      if (data.ok && data.data) {
        const d = data.data
        setForm(f => ({
          ...f,
          vendor: d.vendor || f.vendor,
          date: d.date || f.date,
          amount: d.amount != null ? String(d.amount) : f.amount,
          vatAmount: d.vatAmount != null ? String(d.vatAmount) : f.vatAmount,
          description: d.description || f.description,
          reference: d.reference || f.reference,
        }))
        setScanResult('✓ Adatok kinyerve – ellenőrizd és mentsd!')
      } else {
        setScanResult('Nem sikerült az adatokat kinyerni. Töltsd ki kézzel.')
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  // Recurring
  function openNewRecurring() {
    setEditRecurring(null)
    setRecForm({
      name: '', vendor: '', amount: '', currency: 'EUR', category: '',
      frequency: 'monthly', startDate: format(new Date(), 'yyyy-MM-dd'),
      nextDue: format(new Date(), 'yyyy-MM-dd'), notes: '',
    })
    setShowRecurringModal(true)
  }

  async function handleSaveRecurring() {
    const body = { ...recForm, amount: Number(recForm.amount) }
    if (editRecurring) {
      await fetch(`/api/recurring-expenses/${editRecurring.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/recurring-expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setShowRecurringModal(false)
    fetchData()
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm('Törlöd ezt a visszatérő tételt?')) return
    await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  // Summary calculations
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalIncome = invoices.reduce((s, i) => s + i.total, 0)
  const balance = totalIncome - totalExpenses

  // Due recurring this month
  const dueThisMonth = recurring.filter(r => r.active && r.nextDue.startsWith(monthKey))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Könyvelés</h1>
          <p className="text-gray-500 mt-0.5">Kiadások és bevételek nyilvántartása</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Új kiadás
        </button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setSelectedMonth(m => subMonths(m, 1))}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          ‹
        </button>
        <span className="text-lg font-semibold text-gray-800 min-w-[140px] text-center">
          {format(selectedMonth, 'yyyy. MMMM', { locale: hu })}
        </span>
        <button
          onClick={() => setSelectedMonth(m => addMonths(m, 1))}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          ›
        </button>
        <button
          onClick={() => setSelectedMonth(startOfMonth(new Date()))}
          className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Ma
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className="text-xs text-gray-500 font-medium">Bevételek</p>
          </div>
          <p className="text-xl font-bold text-green-600">{fmtEur(totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{invoices.length} befizetett számla</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-500" />
            <p className="text-xs text-gray-500 font-medium">Kiadások</p>
          </div>
          <p className="text-xl font-bold text-red-600">{fmtEur(totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{expenses.length} kiadás</p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${balance >= 0 ? 'border-green-100' : 'border-red-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-gray-500 font-medium">Egyenleg</p>
          </div>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {balance >= 0 ? '+' : ''}{fmtEur(balance)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Havi nettó</p>
        </div>
      </div>

      {/* Recurring due alert */}
      {dueThisMonth.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {dueThisMonth.length} visszatérő díj esedékes ebben a hónapban
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {dueThisMonth.map(r => `${r.name} (${fmtEur(r.amount)})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([
          { id: 'expenses', label: 'Kiadások' },
          { id: 'recurring', label: 'Visszatérő költségek' },
          { id: 'summary', label: 'Havi összesítő' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Betöltés...</div>
      ) : tab === 'expenses' ? (
        /* ── KIADÁSOK ── */
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingDown size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nincs rögzített kiadás ebben a hónapban</p>
              <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">
                + Kiadás hozzáadása
              </button>
            </div>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{exp.vendor}</span>
                    {exp.category && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{exp.category}</span>
                    )}
                    <span className="text-xs text-gray-400">{format(new Date(exp.date), 'yyyy. MMM d.', { locale: hu })}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{exp.description}</p>
                  {exp.reference && <p className="text-xs font-mono text-gray-400">{exp.reference}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{fmtEur(exp.amount)}</p>
                  {exp.vatAmount > 0 && (
                    <p className="text-xs text-gray-400">+ÁFA: {fmtEur(exp.vatAmount)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEdit(exp)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      ) : tab === 'recurring' ? (
        /* ── VISSZATÉRŐ ── */
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button
              onClick={openNewRecurring}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} /> Új visszatérő tétel
            </button>
          </div>
          {recurring.length === 0 ? (
            <div className="py-16 text-center">
              <RepeatIcon size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nincs visszatérő költség beállítva</p>
            </div>
          ) : (
            recurring.map(rec => {
              const isDue = rec.nextDue.startsWith(monthKey)
              return (
                <div key={rec.id} className={`bg-white rounded-xl border p-3.5 flex items-center gap-3 ${isDue ? 'border-amber-200' : 'border-gray-100'}`}>
                  <RepeatIcon size={16} className={isDue ? 'text-amber-500 shrink-0' : 'text-gray-300 shrink-0'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{rec.name}</span>
                      {rec.vendor && <span className="text-xs text-gray-400">{rec.vendor}</span>}
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{FREQ_LABELS[rec.frequency]}</span>
                      {!rec.active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inaktív</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Következő: {format(new Date(rec.nextDue), 'yyyy. MMM d.', { locale: hu })}
                      {isDue && <span className="text-amber-600 font-medium ml-1">– Esedékes!</span>}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 shrink-0">{fmtEur(rec.amount)}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditRecurring(rec)
                        setRecForm({
                          name: rec.name, vendor: rec.vendor || '', amount: String(rec.amount),
                          currency: rec.currency, category: rec.category || '',
                          frequency: rec.frequency, startDate: rec.nextDue.slice(0, 10),
                          nextDue: rec.nextDue.slice(0, 10), notes: rec.notes || '',
                        })
                        setShowRecurringModal(true)
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteRecurring(rec.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

      ) : (
        /* ── ÖSSZESÍTŐ ── */
        <div className="space-y-4">
          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Kiadások kategória szerint</h3>
            {expenses.length === 0 ? (
              <p className="text-gray-400 text-sm">Nincs adat</p>
            ) : (
              (() => {
                const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
                  const cat = e.category || 'Egyéb'
                  acc[cat] = (acc[cat] || 0) + e.amount
                  return acc
                }, {})
                const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
                const max = sorted[0]?.[1] || 1
                return (
                  <div className="space-y-2">
                    {sorted.map(([cat, amount]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                          <span>{cat}</span>
                          <span className="font-medium">{fmtEur(amount)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(amount / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>

          {/* Invoice income */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Befizetett számlák (bevétel)</h3>
            {invoices.length === 0 ? (
              <p className="text-gray-400 text-sm">Nincs befizetett számla ebben a hónapban</p>
            ) : (
              <div className="space-y-1.5">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex justify-between text-sm">
                    <span className="font-mono text-gray-600">{inv.number} – {inv.company?.name || '—'}</span>
                    <span className="font-semibold text-green-700">{fmtEur(inv.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-2">
                  <span>Összesen:</span>
                  <span className="text-green-700">{fmtEur(totalIncome)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Expense modal ── */}
      {showModal && (
        <Modal
          title={editExpense ? 'Kiadás szerkesztése' : 'Új kiadás'}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            {/* OCR scan */}
            {!editExpense && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleScanFile(e.target.files[0]) }}
                />
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileRef.current) {
                        fileRef.current.removeAttribute('capture')
                        fileRef.current.setAttribute('accept', 'image/*,application/pdf')
                        fileRef.current.click()
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    <Upload size={14} /> Feltöltés (kép / PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (fileRef.current) {
                        fileRef.current.setAttribute('capture', 'environment')
                        fileRef.current.setAttribute('accept', 'image/*')
                        fileRef.current.click()
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                  >
                    <Camera size={14} /> Fotózás
                  </button>
                </div>
                {scanning && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center justify-center gap-1">
                    <RefreshCw size={12} className="animate-spin" /> AI feldolgozás...
                  </p>
                )}
                {scanResult && (
                  <p className={`text-xs mt-2 flex items-center justify-center gap-1 ${scanResult.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>
                    {scanResult.startsWith('✓') ? <Check size={12} /> : <AlertCircle size={12} />}
                    {scanResult}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dátum *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Üzlet / Szállító *</label>
                <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                  placeholder="pl. REWE, Amazon, Avery..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Leírás *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mit vásároltál?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Összeg *</label>
                <input type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ÁFA összeg</label>
                <input type="number" min={0} step={0.01} value={form.vatAmount} onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategória</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Kategória —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bizonylat száma</label>
                <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="Számla / nyugta szám"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                Mégse
              </button>
              <button
                type="button"
                disabled={!form.vendor || !form.description || !form.amount}
                onClick={handleSaveExpense}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {editExpense ? 'Módosítás' : 'Mentés'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Recurring modal ── */}
      {showRecurringModal && (
        <Modal
          title={editRecurring ? 'Visszatérő tétel szerkesztése' : 'Új visszatérő tétel'}
          onClose={() => setShowRecurringModal(false)}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Megnevezés *</label>
                <input type="text" value={recForm.name} onChange={e => setRecForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="pl. Adobe CC, Shopify, bérleti díj..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Szállító</label>
                <input type="text" value={recForm.vendor} onChange={e => setRecForm(f => ({ ...f, vendor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Összeg *</label>
                <input type="number" min={0} step={0.01} value={recForm.amount} onChange={e => setRecForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gyakoriság</label>
                <select value={recForm.frequency} onChange={e => setRecForm(f => ({ ...f, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="weekly">Heti</option>
                  <option value="monthly">Havi</option>
                  <option value="quarterly">Negyedéves</option>
                  <option value="yearly">Éves</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Következő esedékesség</label>
                <input type="date" value={recForm.nextDue} onChange={e => setRecForm(f => ({ ...f, nextDue: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategória</label>
                <select value={recForm.category} onChange={e => setRecForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Kategória —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowRecurringModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
                Mégse
              </button>
              <button
                type="button"
                disabled={!recForm.name || !recForm.amount}
                onClick={handleSaveRecurring}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {editRecurring ? 'Módosítás' : 'Mentés'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
