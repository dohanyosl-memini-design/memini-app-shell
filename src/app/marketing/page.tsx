'use client'

import { useState } from 'react'
import { Layers, CalendarDays, FileText } from 'lucide-react'
import MarketingArcTree from '@/components/marketing/MarketingArcTree'
import MarketingCalendar from '@/components/marketing/MarketingCalendar'
import ContentLibrary from '@/components/marketing/ContentLibrary'

type View = 'tree' | 'calendar' | 'library'

const VIEWS: { key: View; label: string; icon: typeof Layers }[] = [
  { key: 'tree',     label: 'Ív',        icon: Layers },
  { key: 'calendar', label: 'Naptár',    icon: CalendarDays },
  { key: 'library',  label: 'Tartalmak', icon: FileText },
]

export default function MarketingPage() {
  const [view, setView] = useState<View>('tree')

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {view === 'tree' ? 'Stratégiai ív, témák és tartalmak' : view === 'calendar' ? 'Marketingnaptár' : 'Tartalom-könyvtár'}
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors text-sm ${view === v.key ? 'bg-white shadow-sm text-violet-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
              <v.icon size={15} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'tree' && <MarketingArcTree />}
      {view === 'calendar' && <MarketingCalendar />}
      {view === 'library' && <ContentLibrary />}
    </div>
  )
}
