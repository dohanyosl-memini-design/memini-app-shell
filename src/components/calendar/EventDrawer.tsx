'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { X, ArrowUpRight, Calendar, Clock } from 'lucide-react'
import type { CalendarEvent } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'

interface Props {
  event: CalendarEvent | null
  onClose: () => void
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:    { label: 'Nyitott', cls: 'bg-blue-100 text-blue-700' },
  done:    { label: 'Kész',    cls: 'bg-gray-100 text-gray-600' },
  overdue: { label: 'Lejárt',  cls: 'bg-red-100 text-red-700' },
}

export default function EventDrawer({ event, onClose }: Props) {
  if (!event) return null
  const meta = SOURCE_META[event.source]
  const st = event.status ? STATUS_LABEL[event.status] : null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${meta.badge}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 leading-snug">{event.title}</h2>

          {event.subtitle && <p className="text-sm text-gray-600">{event.subtitle}</p>}

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={15} className="text-gray-400" />
              {format(new Date(event.date), 'yyyy. MMMM d., EEEE', { locale: hu })}
            </div>
            {event.time && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={15} className="text-gray-400" /> {event.time}
              </div>
            )}
            {st && (
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
              </div>
            )}
          </div>

          {event.meta && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">{event.meta}</div>
          )}
        </div>

        <div className="border-t border-gray-100 p-4">
          <Link
            href={event.linkTo}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Megnyitás a CRM-ben <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
    </>
  )
}
