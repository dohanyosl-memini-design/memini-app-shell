'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Shield, Clock, CheckCircle, Database, HardDrive, AlertTriangle, Upload, RotateCcw, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import PinModal from '@/components/PinModal'

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
  'Memória bejegyzések',
  'Kommunikációs sablonok',
]

type RestoreMode = 'safe' | 'full'

type RestoreResult = {
  ok: boolean
  mode: RestoreMode
  results: Record<string, number>
  total: number
}

type PinAction = 'download' | 'restore' | 'probe'

/** Emberi méret: 1234567 → „1,2 MB”. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupPage() {
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  // PIN modal state
  const [pinAction, setPinAction] = useState<PinAction | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  // Download state
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [probeResult, setProbeResult] = useState<{ bytes: number; total: number } | null>(null)

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('safe')
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [parsedBackupMeta, setParsedBackupMeta] = useState<{ exportedAt?: string; version?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lastBackup')
    if (stored) setLastBackup(stored)
  }, [])

  function openPin(action: PinAction) {
    setPinAction(action)
    setPinError(null)
  }

  function closePin() {
    setPinAction(null)
    setPinError(null)
    setPinLoading(false)
  }

  async function handlePinSubmit(pin: string) {
    setPinLoading(true)
    setPinError(null)
    if (pinAction === 'download') {
      await executeDownload(pin)
    } else if (pinAction === 'probe') {
      await executeProbe(pin)
    } else if (pinAction === 'restore') {
      await executeRestore(pin)
    }
  }

  // Közös hívás a /api/backup felé; a hibát megkülönböztethető szöveggé alakítja.
  async function callBackup(pin: string, probe: boolean): Promise<Response> {
    return fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, probe }),
      // A teljes export tovább tarthat, mint egy próba; adjunk neki bőven időt.
      signal: AbortSignal.timeout(probe ? 60000 : 120000),
    })
  }

  function describeError(err: unknown): string {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return 'Időtúllépés — az export túl sokáig tartott. Próbáld a „Méret ellenőrzése” gombot, vagy használd a Neon mentést.'
    }
    if (err instanceof Error) return err.message
    return 'Ismeretlen hiba.'
  }

  async function executeDownload(pin: string) {
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await callBackup(pin, false)
      if (!res.ok) {
        // A szerver hibái JSON-ban jönnek; ne dobjuk el a valódi okot.
        let msg = `Szerverhiba (${res.status}).`
        try { const d = await res.json(); if (d?.error) msg = d.error } catch { /* nem JSON */ }
        if (res.status === 401 || res.status === 503) {
          setPinError(msg); setPinLoading(false); setDownloading(false); return
        }
        setDownloadError(msg); closePin(); setDownloading(false); return
      }

      // A választ közvetlenül blobként mentjük — nincs kliensoldali újra-stringify.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memini-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const ts = new Date().toISOString()
      localStorage.setItem('lastBackup', ts)
      setLastBackup(ts)
      closePin()
    } catch (err) {
      setPinError(describeError(err))
      setPinLoading(false)
    } finally {
      setDownloading(false)
    }
  }

  // Próba mód: csak a darabszámok és a méret jönnek le. Így elkülöníthető, hogy
  // a letöltés a lekérdezés lassúsága vagy a fájlméret miatt bukik-e.
  async function executeProbe(pin: string) {
    setDownloading(true)
    setDownloadError(null)
    setProbeResult(null)
    try {
      const res = await callBackup(pin, true)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401 || res.status === 503) {
          setPinError(data.error ?? 'Helytelen PIN kód.'); setPinLoading(false); setDownloading(false); return
        }
        setDownloadError(data.error ?? 'Hiba történt.'); closePin(); setDownloading(false); return
      }
      setCounts(data.counts)
      const total = Object.values(data.counts as Record<string, number>).reduce((a, b) => a + b, 0)
      setProbeResult({ bytes: data.bytes, total })
      closePin()
    } catch (err) {
      setPinError(describeError(err))
      setPinLoading(false)
    } finally {
      setDownloading(false)
    }
  }

  async function executeRestore(pin: string) {
    if (!restoreFile) return
    setRestoring(true)
    setRestoreResult(null)
    setRestoreError(null)
    try {
      const text = await restoreFile.text()
      const backup = JSON.parse(text)
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup, mode: restoreMode, pin }),
        signal: AbortSignal.timeout(120000),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401 || res.status === 503) {
          setPinError(data.error ?? 'Helytelen PIN kód.')
          setPinLoading(false)
          setRestoring(false)
          return
        }
        setRestoreError(data.error ?? 'Ismeretlen hiba.')
        closePin()
      } else {
        setRestoreResult(data as RestoreResult)
        closePin()
      }
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Hálózati hiba.')
      closePin()
    } finally {
      setRestoring(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setRestoreFile(file)
    setRestoreResult(null)
    setRestoreError(null)
    setRestoreConfirmed(false)
    setParsedBackupMeta(null)

    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          if (!parsed?.data || !parsed?.meta) {
            setRestoreError('Érvénytelen backup fájl — hiányzik a data vagy meta mező.')
            setRestoreFile(null)
            return
          }
          setParsedBackupMeta(parsed.meta as { exportedAt?: string; version?: string })
        } catch {
          setRestoreError('A fájl nem olvasható JSON formátumú.')
          setRestoreFile(null)
        }
      }
      reader.readAsText(file)
    }
  }

  function resetRestore() {
    setRestoreFile(null)
    setRestoreResult(null)
    setRestoreError(null)
    setRestoreConfirmed(false)
    setParsedBackupMeta(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {pinAction && (
        <PinModal
          title={
            pinAction === 'download' ? 'Mentés letöltése'
            : pinAction === 'probe' ? 'Méret ellenőrzése'
            : 'Visszaállítás megerősítése'
          }
          description={
            pinAction === 'download'
              ? 'Add meg a 6 jegyű PIN kódot a letöltés engedélyezéséhez.'
              : pinAction === 'probe'
              ? 'Add meg a PIN kódot. Ez csak a darabszámokat és a méretet kéri le, fájl nélkül.'
              : restoreMode === 'full'
              ? 'Add meg a PIN kódot. Ez törli az összes adatot és visszatölti a backupból!'
              : 'Add meg a PIN kódot a visszaállítás engedélyezéséhez.'
          }
          onSubmit={handlePinSubmit}
          onCancel={closePin}
          loading={pinLoading || downloading || restoring}
          error={pinError}
        />
      )}

      <div className="p-4 md:p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Biztonsági mentés</h1>
            <p className="text-gray-500 mt-0.5">Az összes adat exportálása, mentése és visszaállítása</p>
          </div>
        </div>

        {/* Letöltés */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3 bg-blue-50 rounded-xl shrink-0">
              <Database size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Teljes adatexport</h2>
              <p className="text-sm text-gray-500 mt-1">
                Minden adat letöltése egyetlen JSON fájlba — megnyitható, ellenőrizhető, visszaállítható.
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

          {downloadError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">A letöltés nem sikerült</p>
                <p className="text-sm text-red-700 mt-1">{downloadError}</p>
                <p className="text-xs text-red-600 mt-2">
                  Tipp: a Neon adatbázis-branch (pillanatkép) a legmegbízhatóbb mentés, és nem függ ettől.
                </p>
              </div>
            </div>
          )}

          {probeResult && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <CheckCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">Az export elérhető és összeáll</p>
                <p className="text-sm text-blue-700 mt-1">
                  Összesen {probeResult.total} rekord · a fájl mérete kb. {humanSize(probeResult.bytes)}. Most már letöltheted.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => openPin('download')}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 text-sm"
          >
            <Download size={18} />
            {downloading ? 'Exportálás folyamatban...' : 'Mentés letöltése most'}
          </button>

          <button
            onClick={() => openPin('probe')}
            disabled={downloading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium disabled:opacity-60 text-sm border border-gray-200"
          >
            <Database size={16} />
            Méret ellenőrzése (letöltés nélkül)
          </button>
        </div>

        {/* Visszaállítás */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3 bg-orange-50 rounded-xl shrink-0">
              <RotateCcw size={24} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Visszaállítás backup fájlból</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tölts fel egy korábban letöltött mentésfájlt az adatok helyreállításához.
              </p>
            </div>
          </div>

          {restoreResult && (
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-600" />
                <p className="font-semibold text-green-800">
                  Visszaállítás sikeres — {restoreResult.total} rekord feldolgozva
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(restoreResult.results).filter(([, v]) => v > 0).map(([key, count]) => (
                  <div key={key} className="bg-white rounded-lg p-2 text-center border border-green-100">
                    <p className="text-base font-bold text-green-700">{count}</p>
                    <p className="text-xs text-gray-500">{key}</p>
                  </div>
                ))}
              </div>
              <button onClick={resetRestore} className="mt-3 text-xs text-green-700 underline hover:no-underline">
                Új visszaállítás indítása
              </button>
            </div>
          )}

          {restoreError && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Hiba történt</p>
                <p className="text-sm text-red-700 mt-1">{restoreError}</p>
                <button onClick={resetRestore} className="mt-2 text-xs text-red-700 underline hover:no-underline">
                  Újrapróbálás
                </button>
              </div>
            </div>
          )}

          {!restoreResult && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup fájl kiválasztása (.json)
                </label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {restoreFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle size={18} className="text-green-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">{restoreFile.name}</p>
                        {parsedBackupMeta?.exportedAt && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Mentés dátuma: {format(new Date(parsedBackupMeta.exportedAt), 'yyyy. MMMM d. HH:mm', { locale: hu })}
                            {parsedBackupMeta.version ? ` · v${parsedBackupMeta.version}` : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); resetRestore() }}
                        className="ml-auto text-gray-400 hover:text-red-500"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Kattints a fájl kiválasztásához</p>
                      <p className="text-xs text-gray-400 mt-1">csak .json formátum</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {restoreFile && parsedBackupMeta && (
                <>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Visszaállítás módja</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="safe"
                          checked={restoreMode === 'safe'}
                          onChange={() => { setRestoreMode('safe'); setRestoreConfirmed(false) }}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Biztonságos — csak hiányzók</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Csak azokat szúrja be, amelyek még nem léteznek. A meglévő rekordokat nem érinti.
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="full"
                          checked={restoreMode === 'full'}
                          onChange={() => { setRestoreMode('full'); setRestoreConfirmed(false) }}
                          className="mt-0.5 accent-red-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Teljes visszaállítás — töröl és újratölt</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Törli az összes jelenlegi adatot, majd betölti a backup tartalmát.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {restoreMode === 'full' && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-red-800">Figyelem: visszafordíthatatlan művelet!</p>
                          <p className="text-sm text-red-700 mt-1">
                            Törli az összes jelenlegi adatot — partnereket, számlákat, termékeket, mindent —, majd újratölti a backup fájlból. Javasolt: előtte töltsd le az aktuális mentést.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-3 mb-5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={restoreConfirmed}
                      onChange={(e) => setRestoreConfirmed(e.target.checked)}
                      className="mt-0.5 accent-blue-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {restoreMode === 'full'
                        ? 'Megértettem, hogy ez törli az összes jelenlegi adatot, és visszaállítja a backup tartalmát.'
                        : 'Visszaállítom a hiányzó adatokat a backup fájlból.'}
                    </span>
                  </label>

                  <button
                    onClick={() => openPin('restore')}
                    disabled={!restoreConfirmed || restoring}
                    className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      restoreMode === 'full'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    <RotateCcw size={18} className={restoring ? 'animate-spin' : ''} />
                    {restoring
                      ? 'Visszaállítás folyamatban...'
                      : restoreMode === 'full'
                      ? 'Teljes visszaállítás indítása'
                      : 'Hiányzó adatok visszaállítása'}
                  </button>
                </>
              )}
            </>
          )}
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

        {/* Tipp */}
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

        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-600">A mentés fájlformátuma:</strong> JSON — géppel és emberrel olvasható szöveges formátum.
            Megnyitható Notepad-del, Excel-lel (importálva), vagy bármilyen szövegszerkesztővel.
            A fájl feltöltésével és visszaállítással az összes rekord helyreállítható.
          </p>
        </div>
      </div>
    </>
  )
}
