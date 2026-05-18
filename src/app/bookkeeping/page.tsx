'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Edit2, Upload, Camera, RefreshCw, TrendingDown, TrendingUp,
  RepeatIcon, X, Check, AlertCircle, Settings, CheckCircle2, Clock, FileInput,
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, addDays } from 'date-fns'
import { hu } from 'date-fns/locale'
import Modal from '@/components/Modal'

interface ExpenseCategory {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

interface Expense {
  id: string
  date: string
  vendor: string
  description: string
  amount: number
  vatAmount: number
  totalAmount: number
  currency: string
  category: string | null
  receiptUrl: string | null
  reference: string | null
  status: string
  notes: string | null
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

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Heti', monthly: 'Havi', quarterly: 'Negyedéves', yearly: 'Éves',
}

function fmtAmount(v: number, currency: string) {
  if (currency === 'HUF') {
    return v.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Ft'
  }
  return '€' + v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtEur(v: number) { return fmtAmount(v, 'EUR') }

const EMPTY_FORM = {
  date: format(new Date(), 'yyyy-MM-dd'),
  vendor: '', description: '', amount: '', vatAmount: '', totalAmount: '',
  currency: 'EUR', category: '', reference: '', status: 'pending', notes: '',
}

interface BulkResult {
  filename: string
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  saved?: boolean
}

export default function BookkeepingPage() {
  const [tab, setTab] = useState<'expenses' | 'recurring' | 'summary' | 'categories'>('expenses')
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)

  // Expense modal
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

  // Single scan
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bulk upload
  const [showBulk, setShowBulk] = useState(false)
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const bulkFileRef = useRef<HTMLInputElement>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Category management
  const [catForm, setCatForm] = useState({ name: '', color: '#6B7280' })
  const [catSaving, setCatSaving] = useState(false)

  // Invoice scan
  const invFileRef = useRef<HTMLInputElement>(null)
  const [showInvScanModal, setShowInvScanModal] = useState(false)
  const [invScanning, setInvScanning] = useState(false)
  const [invSaving, setInvSaving] = useState(false)
  const [invForm, setInvForm] = useState({
    number: '', date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    billingName: '', billingAddress: '', billingZip: '', billingCity: '', billingCountry: '',
    subtotal: 0, vatAmount: 0, total: 0, currency: 'EUR', status: 'open',
  })
  const [invItems, setInvItems] = useState<{ description: string; quantity: number; unitPrice: number; vatRate: number; isDiscount: boolean }[]>([])

  const monthKey = format(selectedMonth, 'yyyy-MM')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [expRes, recRes, invRes, catRes] = await Promise.all([
      fetch(`/api/expenses?month=${monthKey}`),
      fetch('/api/recurring-expenses'),
      fetch('/api/invoices?status=paid'),
      fetch('/api/expense-categories'),
    ])
    const [expData, recData, invData, catData] = await Promise.all([
      expRes.json(), recRes.json(), invRes.json(), catRes.json(),
    ])
    setExpenses(Array.isArray(expData) ? expData : [])
    setRecurring(Array.isArray(recData) ? recData : [])
    setInvoices((Array.isArray(invData) ? invData : []).filter((inv: Invoice) => inv.date?.startsWith(monthKey)))
    setCategories(Array.isArray(catData) ? catData : [])
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
      totalAmount: String(exp.totalAmount || 0),
      currency: exp.currency,
      category: exp.category || '',
      reference: exp.reference || '',
      status: exp.status || 'pending',
      notes: exp.notes || '',
    })
    setShowModal(true)
  }

  async function handleSaveExpense() {
    const body = {
      ...form,
      amount: Number(form.amount),
      vatAmount: Number(form.vatAmount || 0),
      totalAmount: Number(form.totalAmount || 0),
    }
    const url = editExpense ? `/api/expenses/${editExpense.id}` : '/api/expenses'
    const method = editExpense ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowModal(false)
    fetchData()
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Törlöd ezt a kiadást?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Törlöd a kijelölt ${selectedIds.size} kiadást?`)) return
    await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/expenses/${id}`, { method: 'DELETE' })))
    setSelectedIds(new Set())
    fetchData()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === expenses.length ? new Set() : new Set(expenses.map(e => e.id)))
  }

  async function handleToggleStatus(exp: Expense) {
    const newStatus = exp.status === 'pending' ? 'verified' : 'pending'
    await fetch(`/api/expenses/${exp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...exp, status: newStatus }),
    })
    fetchData()
  }

  async function handleScanFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setScanResult('A fájl túl nagy (max 10 MB). Tömörítsd vagy szkenneld alacsonyabb minőségben.')
      return
    }
    setScanning(true)
    setScanResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/expenses/scan', { method: 'POST', body: fd, signal: AbortSignal.timeout(55000) })
      if (!res.ok) { setScanResult('Szerver hiba – töltsd ki kézzel.'); return }
      const data = await res.json()
      if (data.ok && data.data) {
        const d = data.data
        setForm(f => ({
          ...f,
          vendor: d.vendor || f.vendor,
          date: d.date || f.date,
          amount: d.amount != null ? String(d.amount) : f.amount,
          vatAmount: d.vatAmount != null ? String(d.vatAmount) : f.vatAmount,
          totalAmount: d.totalAmount != null ? String(d.totalAmount) : f.totalAmount,
          description: d.description || f.description,
          reference: d.reference || f.reference,
          category: d.category || f.category,
          currency: d.currency || f.currency,
        }))
        setScanResult('✓ Adatok kinyerve – ellenőrizd és mentsd!')
      } else {
        setScanResult('Nem sikerült az adatokat kinyerni. Töltsd ki kézzel.')
      }
    } catch (err) {
      setScanResult(err instanceof Error && err.name === 'TimeoutError'
        ? 'Időtúllépés – próbáld kisebb fájllal, vagy töltsd ki kézzel.'
        : 'Hiba történt – töltsd ki kézzel.')
    } finally {
      setScanning(false)
    }
  }

  // ── TÖMEGES FELTÖLTÉS ──
  async function handleBulkScan() {
    if (bulkFiles.length === 0) return
    setBulkRunning(true)
    setBulkProgress(0)
    setBulkTotal(bulkFiles.length)
    setBulkResults([])

    const results: BulkResult[] = []
    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i]
      setBulkProgress(i)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/expenses/scan', { method: 'POST', body: fd, signal: AbortSignal.timeout(55000) })
        const json = await res.json()
        if (json.ok && json.data) {
          // Auto-save
          const d = json.data
          const saveRes = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: d.date || format(new Date(), 'yyyy-MM-dd'),
              vendor: d.vendor || file.name,
              description: d.description || '',
              amount: Number(d.amount || 0),
              vatAmount: Number(d.vatAmount || 0),
              totalAmount: Number(d.totalAmount || 0),
              currency: d.currency || 'EUR',
              category: d.category || null,
              reference: d.reference || null,
              status: 'pending',
            }),
          })
          results.push({ filename: file.name, ok: true, data: d, saved: saveRes.ok })
        } else {
          results.push({ filename: file.name, ok: false, error: 'Nem sikerült kinyerni az adatokat' })
        }
      } catch {
        results.push({ filename: file.name, ok: false, error: 'Hiba a feldolgozás során' })
      }
      setBulkResults([...results])
    }
    setBulkProgress(bulkFiles.length)
    setBulkRunning(false)
    fetchData()
  }

  // ── VISSZATÉRŐ ──
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
    const url = editRecurring ? `/api/recurring-expenses/${editRecurring.id}` : '/api/recurring-expenses'
    const method = editRecurring ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowRecurringModal(false)
    fetchData()
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm('Törlöd ezt a visszatérő tételt?')) return
    await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  // ── KATEGÓRIA ──
  async function handleAddCategory() {
    if (!catForm.name.trim()) return
    setCatSaving(true)
    await fetch('/api/expense-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm),
    })
    setCatForm({ name: '', color: '#6B7280' })
    setCatSaving(false)
    fetchData()
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Törlöd a "${name}" kategóriát?`)) return
    await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' })
    fetchData()
  }

  // ── INVOICE SCAN ──
  async function handleInvScanFile(file: File) {
    setInvScanning(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/invoices/scan', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok && json.data) {
      const d = json.data
      const items = (Array.isArray(d.items) ? d.items : []).map((it: { description: string; quantity: number; unitPrice: number; vatRate: number }) => ({
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        vatRate: Number(it.vatRate) || 19,
        isDiscount: false,
      }))
      const discounts = (Array.isArray(d.discounts) ? d.discounts : []).map((dis: { description: string; amount: number }) => ({
        description: dis.description || 'Kedvezmény',
        quantity: 1,
        unitPrice: Number(dis.amount) || 0,
        vatRate: 0,
        isDiscount: true,
      }))
      setInvItems([...items, ...discounts])
      setInvForm({
        number: d.number || '',
        date: d.date || format(new Date(), 'yyyy-MM-dd'),
        dueDate: d.dueDate || format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        billingName: d.billingName || '',
        billingAddress: d.billingAddress || '',
        billingZip: d.billingZip || '',
        billingCity: d.billingCity || '',
        billingCountry: d.billingCountry || '',
        subtotal: Number(d.subtotal) || 0,
        vatAmount: Number(d.vatAmount) || 0,
        total: Number(d.total) || 0,
        currency: d.currency || 'EUR',
        // Default to paid — uploaded invoices are already issued income
        status: 'paid',
      })
      setShowInvScanModal(true)
    }
    setInvScanning(false)
  }

  async function handleSaveInvoice() {
    if (!invForm.billingName || !invForm.dueDate || invItems.length === 0) return
    setInvSaving(true)
    const body = {
      number: invForm.number || undefined,
      date: invForm.date,
      dueDate: invForm.dueDate,
      billingName: invForm.billingName,
      billingAddress: invForm.billingAddress || null,
      billingZip: invForm.billingZip || null,
      billingCity: invForm.billingCity || null,
      billingCountry: invForm.billingCountry || null,
      currency: invForm.currency,
      status: invForm.status,
      paidAt: invForm.status === 'paid' ? invForm.date : null,
      items: invItems.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.isDiscount ? -Math.abs(it.unitPrice) : it.unitPrice,
        vatRate: it.vatRate,
        isDiscount: it.isDiscount,
      })),
    }
    const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      setShowInvScanModal(false)
      setInvItems([])
      fetchData()
    } else {
      const err = await res.json()
      alert(err.error || 'Hiba a mentés során')
    }
    setInvSaving(false)
  }

  // Summaries
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || e.amount), 0)
  const totalIncome = invoices.reduce((s, i) => s + i.total, 0)
  const balance = totalIncome - totalExpenses
  const dueThisMonth = recurring.filter(r => r.active && r.nextDue.startsWith(monthKey))

  const categoryNames = categories.map(c => c.name)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Könyvelés</h1>
          <p className="text-gray-500 mt-0.5">Kiadások és bevételek nyilvántartása</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Upload size={16} /> Tömeges feltöltés
          </button>
          <button
            onClick={() => invFileRef.current?.click()}
            disabled={invScanning}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {invScanning ? <RefreshCw size={16} className="animate-spin" /> : <FileInput size={16} />}
            Bevételi számla
          </button>
          <input ref={invFileRef} type="file" accept=".pdf,image/*,.heic,.heif" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleInvScanFile(f); e.target.value = '' }} />
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Új kiadás
          </button>
        </div>
      </div>

      {/* Hónavigátor */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setSelectedMonth(m => subMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">‹</button>
        <span className="text-lg font-semibold text-gray-800 min-w-[140px] text-center">
          {format(selectedMonth, 'yyyy. MMMM', { locale: hu })}
        </span>
        <button onClick={() => setSelectedMonth(m => addMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">›</button>
        <button onClick={() => setSelectedMonth(startOfMonth(new Date()))} className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">Ma</button>
      </div>

      {/* Összesítő kártyák */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-green-500" /><p className="text-xs text-gray-500 font-medium">Bevételek</p></div>
          <p className="text-xl font-bold text-green-600">{fmtEur(totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{invoices.length} befizetett számla</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown size={14} className="text-red-500" /><p className="text-xs text-gray-500 font-medium">Kiadások</p></div>
          <p className="text-xl font-bold text-red-600">{fmtEur(totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{expenses.length} kiadás</p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${balance >= 0 ? 'border-green-100' : 'border-red-100'}`}>
          <p className="text-xs text-gray-500 font-medium mb-1">Egyenleg</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {balance >= 0 ? '+' : ''}{fmtEur(balance)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Havi nettó</p>
        </div>
      </div>

      {/* Esedékes visszatérők */}
      {dueThisMonth.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{dueThisMonth.length} visszatérő díj esedékes ebben a hónapban</p>
            <p className="text-xs text-amber-600 mt-0.5">{dueThisMonth.map(r => `${r.name} (${fmtEur(r.amount)})`).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Fülek */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(([
          { id: 'expenses', label: 'Kiadások' },
          { id: 'recurring', label: 'Visszatérő' },
          { id: 'summary', label: 'Összesítő' },
          { id: 'categories', label: 'Kategóriák', icon: Settings },
        ]) as { id: typeof tab; label: string; icon?: React.ElementType }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.icon && <t.icon size={13} />}{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Betöltés...</div>
      ) : tab === 'expenses' ? (

        /* ── KIADÁSOK ── */
        <div className="space-y-2">
          {expenses.length > 0 && (
            <div className="flex items-center gap-3 px-1 pb-1 border-b border-gray-100 mb-1">
              <input type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                checked={selectedIds.size === expenses.length && expenses.length > 0}
                onChange={toggleSelectAll} />
              {selectedIds.size > 0 ? (
                <>
                  <span className="text-xs text-gray-500">{selectedIds.size} kijelölve</span>
                  <button onClick={handleBulkDelete}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
                    <Trash2 size={12} /> Kijelöltek törlése
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-400">Összes kijelölése</span>
              )}
            </div>
          )}
          {expenses.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingDown size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nincs rögzített kiadás ebben a hónapban</p>
              <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">+ Kiadás hozzáadása</button>
            </div>
          ) : expenses.map(exp => (
            <div key={exp.id} className={`bg-white rounded-xl border p-3.5 flex items-center gap-3 hover:shadow-sm transition-shadow ${selectedIds.has(exp.id) ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100'}`}>
              <input type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                checked={selectedIds.has(exp.id)} onChange={() => toggleSelect(exp.id)} />
              <button onClick={() => handleToggleStatus(exp)} className="shrink-0" title={exp.status === 'verified' ? 'Ellenőrzött' : 'Függőben'}>
                {exp.status === 'verified'
                  ? <CheckCircle2 size={18} className="text-green-500" />
                  : <Clock size={18} className="text-amber-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{exp.vendor}</span>
                  {exp.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: (categories.find(c => c.name === exp.category)?.color || '#6B7280') + '20', color: categories.find(c => c.name === exp.category)?.color || '#6B7280' }}>
                      {exp.category}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{format(new Date(exp.date), 'yyyy. MMM d.', { locale: hu })}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{exp.description}</p>
                {exp.reference && <p className="text-xs font-mono text-gray-400">{exp.reference}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900">{fmtAmount(exp.totalAmount || exp.amount, exp.currency)}</p>
                {exp.vatAmount > 0 && <p className="text-xs text-gray-400">+ÁFA: {fmtAmount(exp.vatAmount, exp.currency)}</p>}
                <p className="text-xs text-gray-400">{exp.currency}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(exp)} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 size={14} /></button>
                <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

      ) : tab === 'recurring' ? (

        /* ── VISSZATÉRŐ ── */
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={openNewRecurring} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
              <Plus size={14} /> Új visszatérő tétel
            </button>
          </div>
          {recurring.length === 0 ? (
            <div className="py-16 text-center">
              <RepeatIcon size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nincs visszatérő költség beállítva</p>
            </div>
          ) : recurring.map(rec => {
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
                <p className="font-bold text-gray-900 shrink-0">{fmtAmount(rec.amount, rec.currency)}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditRecurring(rec); setRecForm({ name: rec.name, vendor: rec.vendor || '', amount: String(rec.amount), currency: rec.currency, category: rec.category || '', frequency: rec.frequency, startDate: rec.nextDue.slice(0, 10), nextDue: rec.nextDue.slice(0, 10), notes: rec.notes || '' }); setShowRecurringModal(true) }} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteRecurring(rec.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>

      ) : tab === 'summary' ? (

        /* ── ÖSSZESÍTŐ ── */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Kiadások kategória szerint</h3>
            {expenses.length === 0 ? <p className="text-gray-400 text-sm">Nincs adat</p> : (() => {
              const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
                const cat = e.category || 'Egyéb'
                acc[cat] = (acc[cat] || 0) + (e.totalAmount || e.amount)
                return acc
              }, {})
              const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
              const max = sorted[0]?.[1] || 1
              return (
                <div className="space-y-2">
                  {sorted.map(([cat, amount]) => {
                    const catColor = categories.find(c => c.name === cat)?.color || '#6B7280'
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                          <span>{cat}</span><span className="font-medium">{fmtEur(amount)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(amount / max) * 100}%`, backgroundColor: catColor }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Befizetett számlák (bevétel)</h3>
            {invoices.length === 0 ? <p className="text-gray-400 text-sm">Nincs befizetett számla ebben a hónapban</p> : (
              <div className="space-y-1.5">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex justify-between text-sm">
                    <span className="font-mono text-gray-600">{inv.number} – {inv.company?.name || '—'}</span>
                    <span className="font-semibold text-green-700">{fmtEur(inv.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-2">
                  <span>Összesen:</span><span className="text-green-700">{fmtEur(totalIncome)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      ) : (

        /* ── KATEGÓRIÁK ── */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Kategória hozzáadása</h3>
            <div className="flex gap-2">
              <input type="text" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Kategória neve..." onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" title="Szín" />
              <button onClick={handleAddCategory} disabled={!catForm.name.trim() || catSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Meglévő kategóriák</h3>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-gray-700 flex-1">{cat.name}</span>
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ÚJ KIADÁS MODAL ── */}
      {showModal && (
        <Modal title={editExpense ? 'Kiadás szerkesztése' : 'Új kiadás'} onClose={() => setShowModal(false)} size="lg">
          <div className="space-y-4">
            {!editExpense && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif,application/pdf" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleScanFile(e.target.files[0]) }} />
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click() }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                    <Upload size={14} /> PDF / Kép / HEIC
                  </button>
                  <button type="button" onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.setAttribute('accept', 'image/*'); fileRef.current?.click() }}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm">
                    <Camera size={14} /> Fotózás
                  </button>
                </div>
                {scanning && <p className="text-xs text-blue-600 mt-2 flex items-center justify-center gap-1"><RefreshCw size={12} className="animate-spin" /> Arthur feldolgozza...</p>}
                {scanResult && (
                  <p className={`text-xs mt-2 flex items-center justify-center gap-1 ${scanResult.startsWith('✓') ? 'text-green-600' : 'text-amber-600'}`}>
                    {scanResult.startsWith('✓') ? <Check size={12} /> : <AlertCircle size={12} />} {scanResult}
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
                  placeholder="pl. OBI, Amazon..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Leírás *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mit vásároltál?" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nettó összeg</label>
                <input type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ÁFA összeg</label>
                <input type="number" min={0} step={0.01} value={form.vatAmount} onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value }))}
                  placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bruttó összeg *</label>
                <input type="number" min={0} step={0.01} value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deviza</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="EUR">EUR (€)</option>
                  <option value="HUF">HUF (Ft)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategória</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Válassz —</option>
                  {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bizonylat száma</label>
                <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="Számla / nyugta szám" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Státusz</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="pending">Függőben</option>
                  <option value="verified">Ellenőrzött</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Mégse</button>
              <button type="button" disabled={!form.vendor || !form.description || !form.totalAmount} onClick={handleSaveExpense}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {editExpense ? 'Módosítás' : 'Mentés'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── TÖMEGES FELTÖLTÉS MODAL ── */}
      {showBulk && (
        <Modal title="Tömeges számlafeltöltés" onClose={() => { if (!bulkRunning) { setShowBulk(false); setBulkFiles([]); setBulkResults([]) } }} size="lg">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <input ref={bulkFileRef} type="file" multiple accept="image/*,.heic,.heif,application/pdf" className="hidden"
                onChange={e => setBulkFiles(Array.from(e.target.files || []))} />
              <Upload size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">PDF, JPEG, PNG, HEIC fájlok</p>
              <button type="button" onClick={() => bulkFileRef.current?.click()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                Fájlok kiválasztása
              </button>
            </div>

            {bulkFiles.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">{bulkFiles.length} fájl kiválasztva:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {bulkFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      {bulkResults[i] ? (
                        bulkResults[i].ok
                          ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                          : <AlertCircle size={12} className="text-red-400 shrink-0" />
                      ) : bulkRunning && i === bulkProgress
                        ? <RefreshCw size={12} className="text-blue-500 animate-spin shrink-0" />
                        : <div className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />}
                      <span className="truncate">{f.name}</span>
                      {bulkResults[i] && (
                        <span className={bulkResults[i].ok ? 'text-green-600 shrink-0' : 'text-red-400 shrink-0'}>
                          {bulkResults[i].ok ? '✓ Mentve' : '✗ Hiba'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bulkRunning && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Arthur feldolgozza...</span>
                  <span>{bulkProgress}/{bulkTotal}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {!bulkRunning && bulkResults.length > 0 && (
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${bulkResults.every(r => r.ok) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {bulkResults.filter(r => r.ok).length}/{bulkResults.length} számla sikeresen feldolgozva és mentve.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowBulk(false); setBulkFiles([]); setBulkResults([]) }} disabled={bulkRunning}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50">Bezárás</button>
              <button type="button" onClick={handleBulkScan} disabled={bulkFiles.length === 0 || bulkRunning}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {bulkRunning ? <><RefreshCw size={14} className="animate-spin" /> Feldolgozás...</> : <><Upload size={14} /> Arthur, feldolgozd!</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── VISSZATÉRŐ MODAL ── */}
      {showRecurringModal && (
        <Modal title={editRecurring ? 'Visszatérő tétel szerkesztése' : 'Új visszatérő tétel'} onClose={() => setShowRecurringModal(false)} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Megnevezés *</label>
                <input type="text" value={recForm.name} onChange={e => setRecForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="pl. Adobe CC, Shopify..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Deviza</label>
                <select value={recForm.currency} onChange={e => setRecForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="EUR">EUR (€)</option>
                  <option value="HUF">HUF (Ft)</option>
                </select>
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategória</label>
                <select value={recForm.category} onChange={e => setRecForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Válassz —</option>
                  {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowRecurringModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm">Mégse</button>
              <button type="button" disabled={!recForm.name || !recForm.amount} onClick={handleSaveRecurring}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {editRecurring ? 'Módosítás' : 'Mentés'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Bevételi számla scan modal ── */}
      {showInvScanModal && (
        <Modal title="Bevételi számla beolvasva" onClose={() => setShowInvScanModal(false)}>
          <div className="space-y-3 p-1 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Számlaszám</label>
                <input type="text" value={invForm.number} onChange={e => setInvForm(f => ({ ...f, number: e.target.value }))}
                  placeholder="pl. 05/2026" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Pénznem</label>
                <select value={invForm.currency} onChange={e => setInvForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="EUR">EUR</option>
                  <option value="HUF">HUF</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Kiállítás dátuma</label>
                <input type="date" value={invForm.date} onChange={e => setInvForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fizetési határidő</label>
                <input type="date" value={invForm.dueDate} onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vevő neve *</label>
              <input type="text" value={invForm.billingName} onChange={e => setInvForm(f => ({ ...f, billingName: e.target.value }))}
                placeholder="Ügyfél neve..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Irányítószám</label>
                <input type="text" value={invForm.billingZip} onChange={e => setInvForm(f => ({ ...f, billingZip: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Város</label>
                <input type="text" value={invForm.billingCity} onChange={e => setInvForm(f => ({ ...f, billingCity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>

            {/* Tételek listája */}
            {invItems.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tételek ({invItems.length} db)</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Megnevezés</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium w-10">Db</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium w-16">Ár</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium w-10">ÁFA</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invItems.map((item, i) => (
                        <tr key={i} className={item.isDiscount ? 'bg-amber-50' : ''}>
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.description}
                              onChange={e => setInvItems(prev => prev.map((it, j) => j === i ? { ...it, description: e.target.value } : it))}
                              className="w-full bg-transparent border-none outline-none text-gray-700 text-xs" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input type="number" value={item.quantity} min={0} step={1}
                              onChange={e => setInvItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: Number(e.target.value) } : it))}
                              className="w-10 bg-transparent border-none outline-none text-gray-700 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input type="number" value={item.unitPrice} min={0} step={0.01}
                              onChange={e => setInvItems(prev => prev.map((it, j) => j === i ? { ...it, unitPrice: Number(e.target.value) } : it))}
                              className="w-16 bg-transparent border-none outline-none text-gray-700 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-400">{item.vatRate}%</td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => setInvItems(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Összesítő — valós időben számolódik a tételekből */}
            {(() => {
              const calcSubtotal = invItems
                .filter(it => !it.isDiscount)
                .reduce((s, it) => s + it.quantity * it.unitPrice, 0)
              const calcDiscount = invItems
                .filter(it => it.isDiscount)
                .reduce((s, it) => s + it.unitPrice, 0)
              const calcVat = invItems
                .filter(it => !it.isDiscount)
                .reduce((s, it) => s + it.quantity * it.unitPrice * (it.vatRate / 100), 0)
              const calcTotal = calcSubtotal - calcDiscount + calcVat
              return (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                  <div className="space-y-0.5 text-xs text-gray-500">
                    <div>Nettó: <span className="font-medium text-gray-700">{fmtAmount(calcSubtotal - calcDiscount, invForm.currency)}</span></div>
                    <div>ÁFA: <span className="font-medium text-gray-700">{fmtAmount(calcVat, invForm.currency)}</span></div>
                    {calcDiscount > 0 && <div className="text-amber-600">Kedvezmény: -{fmtAmount(calcDiscount, invForm.currency)}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Végösszeg</div>
                    <div className="text-lg font-bold text-green-700">{fmtAmount(calcTotal, invForm.currency)}</div>
                  </div>
                </div>
              )
            })()}

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Státusz</label>
              <select value={invForm.status} onChange={e => setInvForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="open">Nyitott</option>
                <option value="paid">Befizetett</option>
                <option value="sent">Kiküldött</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowInvScanModal(false); setInvItems([]) }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Mégse
              </button>
              <button onClick={handleSaveInvoice} disabled={invSaving || !invForm.billingName || invItems.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {invSaving ? 'Mentés...' : 'Mentés számlák közé'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
