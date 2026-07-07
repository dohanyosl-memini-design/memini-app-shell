'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, User, Building2, Calendar, DollarSign } from 'lucide-react'
import Modal from '@/components/Modal'
import DealForm from '@/components/DealForm'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { DEAL_STAGES, DEFAULT_DEAL_STAGE, CLOSED_STAGES, normalizeStage } from '@/lib/dealStages'

interface Deal {
  id: string
  title: string
  value: number
  stage: string
  probability: number
  closeDate: string | null
  notes: string | null
  contactId: string | null
  companyId: string | null
  contact: { firstName: string; lastName: string } | null
  company: { name: string } | null
}

const STAGES = DEAL_STAGES

function formatCurrency(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M €`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k €`
  return `${value.toFixed(2)} €`
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [initialStage, setInitialStage] = useState<string>(DEFAULT_DEAL_STAGE)
  const [dragging, setDragging] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/deals')
    const data = await res.json()
    setDeals(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretné ezt a dealt?')) return
    await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    fetchDeals()
  }

  function handleEdit(deal: Deal) {
    setEditDeal(deal)
    setShowModal(true)
  }

  function handleAdd(stage: string) {
    setEditDeal(null)
    setInitialStage(stage)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditDeal(null)
  }

  function handleSave() {
    handleModalClose()
    fetchDeals()
  }

  async function handleDrop(stage: string, dealId: string) {
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage === stage) return

    await fetch(`/api/deals/${dealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...deal, stage }),
    })
    fetchDeals()
  }

  const totalPipeline = deals
    .filter((d) => !CLOSED_STAGES.includes(normalizeStage(d.stage)))
    .reduce((sum, d) => sum + d.value, 0)

  const totalWon = deals.filter((d) => normalizeStage(d.stage) === 'won').reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-500 mt-1">
            Pipeline értéke: <strong>{formatCurrency(totalPipeline)}</strong> · Nyert: <strong className="text-green-600">{formatCurrency(totalWon)}</strong>
          </p>
        </div>
        <button
          onClick={() => handleAdd(DEFAULT_DEAL_STAGE)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Új deal
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Betöltés...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 mt-4">
          {STAGES.map(({ key, label, color, headerColor }) => {
            const stageDeals = deals.filter((d) => normalizeStage(d.stage) === key)
            const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0)

            return (
              <div
                key={key}
                className={`flex-shrink-0 w-64 bg-gray-50 rounded-xl border-2 ${color} flex flex-col`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragging) handleDrop(key, dragging)
                  setDragging(null)
                }}
              >
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${headerColor}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-500">{stageDeals.length}</span>
                  </div>
                  {stageTotal > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{formatCurrency(stageTotal)}</p>
                  )}
                </div>

                <div className="flex-1 p-2 space-y-2 min-h-32">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragging(deal.id)}
                      onDragEnd={() => setDragging(null)}
                      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${dragging === deal.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEdit(deal)}
                            className="text-gray-300 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(deal.id)}
                            className="text-gray-300 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {deal.value > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <DollarSign size={10} />
                          <span className="font-medium">{formatCurrency(deal.value)}</span>
                        </div>
                      )}

                      {deal.contact && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User size={10} />
                          {deal.contact.firstName} {deal.contact.lastName}
                        </div>
                      )}
                      {deal.company && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Building2 size={10} />
                          {deal.company.name}
                        </div>
                      )}
                      {deal.closeDate && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar size={10} />
                          {format(new Date(deal.closeDate), 'MMM d.', { locale: hu })}
                        </div>
                      )}

                      {deal.probability > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Valószínűség</span>
                            <span>{deal.probability}%</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-1">
                            <div
                              className="bg-blue-400 h-1 rounded-full"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAdd(key)}
                  className="m-2 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={13} />
                  Deal hozzáadása
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editDeal ? 'Deal szerkesztése' : 'Új deal'} onClose={handleModalClose} size="lg">
          <DealForm deal={editDeal} initialStage={initialStage} onSave={handleSave} onCancel={handleModalClose} />
        </Modal>
      )}
    </div>
  )
}
