'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import { Skull, AlertTriangle } from 'lucide-react'

// Elvesztettbe / temetőbe léptetés kötelező indokkal. Az "OK" gomb tiltott,
// amíg nincs legalább MIN_REASON_LENGTH karakternyi szöveg — se kattintással,
// se máshogy nem lehet indok nélkül átrakni valakit a temetőbe.
export const MIN_REASON_LENGTH = 10

interface LostReasonModalProps {
  /** Kit teszünk a temetőbe (a fejlécben jelenik meg) */
  entityName: string
  /** Cím felülírása (alap: „… a temetőbe") */
  title?: string
  /** A megerősítő gomb szövege (alap: „Temetőbe") */
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export default function LostReasonModal({
  entityName,
  title,
  confirmLabel = 'Temetőbe',
  busy = false,
  onCancel,
  onConfirm,
}: LostReasonModalProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const valid = trimmed.length >= MIN_REASON_LENGTH

  return (
    <Modal title={title ?? `${entityName} a temetőbe`} onClose={onCancel}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-amber-800">
            Semmi nem törlődik — a cég minden adata megmarad, és bármikor
            visszahozható a temetőből. De hogy később tanuljunk belőle,{' '}
            <strong>kötelező megírni, miért veszett el.</strong>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Miért veszett el? <span className="text-red-500">*</span>
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Pl. „Telefonon jelezte, hogy másik beszállítóval szerződtek 2 évre. (2026-08-09)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="mt-1 text-xs text-gray-400">
            {trimmed.length < MIN_REASON_LENGTH
              ? `Még legalább ${MIN_REASON_LENGTH - trimmed.length} karakter szükséges.`
              : 'Rendben — most már temetőbe helyezhető.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Mégse
          </button>
          <button
            onClick={() => valid && onConfirm(trimmed)}
            disabled={!valid || busy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Skull size={16} />
            {busy ? 'Folyamatban…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
