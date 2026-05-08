'use client'

import { useState, useEffect } from 'react'
import { Download, Shield, Clock, CheckCircle, Database, HardDrive, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

const INCLUDED_DATA = [
  'Partnerek (kontaktok)',
  'Cégek',
  'Termékek + készletmozgás',
  'Megrendelések + tételek',
  'Számlák + tételek',
  'Ajánlatok + tételek',
  'Kiadások (könyvelés)',
  'Visszatérő költségek',
  'Üzletek (deals)',
  'Feladatok + alfeladatok',
  'Tevékenységnapló',
  'Árlista bejegyzések',
]

export default function BackupPage() {
  const [loading, setLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lastBackup')
    if (stored) setLastBackup(stored)
  }, [])

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch('/api/backup', { signal: AbortSignal.timeout(55000) })
      if (!res.ok) throw new Error('backup failed')

      const data = await res.json()
      setCounts(data.counts)

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memini-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const ts = new Date().toISOString()
      localStorage.setItem('lastBackup', ts)
      setLastBackup(ts)
    } catch {
      alert('Hiba a biztonsági mentés letöltése közben. Próbáld újra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biztonsági mentés</h1>
          <p className="text-gray-500 mt-0.5">Az összes adat exportálása és mentése</p>
        </div>
      </div>

      {/* Fő letöltés kártya */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 bg-blue-50 rounded-xl shrink-0">
            <Database size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Teljes adatexport</h2>
            <p className="text-sm text-gray-500 mt-1">
              Minden adat letöltése egyetlen JSON fájlba — megnyitható, ellenőrizhető, és visszaállítható belőle az összes rekord.
            </p>
            {lastBackup ? (
              <p className="text-xs text-green-600 flex items-center gap-1.5 mt-2 font-medium">
                <CheckCircle size={12} />
                Utolsó mentés: {format(new Date(lastBackup), 'yyyy. MMMM d. HH:mm', { locale: hu })}
              </p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1.5 mt-2">
                <AlertTriangle size={12} />
                Még nem készült mentés ebből a böngészőből
              </p>
            )}
          </div>
        </div>

        {counts && (
          <div className="grid grid-cols-3 gap-2 mb-5 p-3 bg-gray-50 rounded-lg">
            {Object.entries(counts).map(([key, count]) => (
              <div key={key} className="text-center">
                <p className="text-lg font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-400">{key}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 text-sm"
        >
          <Download size={18} />
          {loading ? 'Exportálás folyamatban...' : 'Mentés letöltése most'}
        </button>
      </div>

      {/* Mi kerül bele */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <HardDrive size={14} className="text-gray-400" />
          Mi kerül bele a mentésbe?
        </h3>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          {INCLUDED_DATA.map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle size={13} className="text-green-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Heti emlékeztető tipp */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
        <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Ajánlott: heti mentés</p>
          <p className="text-sm text-amber-700 mt-1">
            Állíts be egy heti ismétlődő naptáreseményt (pl. minden hétfőn reggel), és mentsd a letöltött fájlt egy külső helyre:
          </p>
          <ul className="mt-2 space-y-1">
            {['Google Drive / OneDrive / iCloud', 'Külső merevlemez vagy USB', 'Email magadnak (csatolmányként)'].map(tip => (
              <li key={tip} className="text-sm text-amber-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* A fájlról */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-600">A mentés fájlformátuma:</strong> JSON — géppel és emberrel olvasható szöveges formátum.
          Megnyitható Notepad-del, Excel-lel (importálva), vagy bármilyen szövegszerkesztővel.
          Szükség esetén az adatok visszaállíthatók ebből a fájlból.
        </p>
      </div>
    </div>
  )
}
