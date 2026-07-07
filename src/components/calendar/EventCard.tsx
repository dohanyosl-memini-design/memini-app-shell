'use client'

import { Clock } from 'lucide-react'
import type { CalendarEvent } from '@/lib/calendar/types'
import { SOURCE_META } from '@/lib/calendar/types'

interface Props {
  event: CalendarEvent
  onClick: (e: CalendarEvent) => void
}

export default function EventCard({ event, onClick }: Props) {
  const meta = SOURCE_META[event.source]
  const isOverdue = event.status === 'overdue'
  // Múltbeli, megtörtént activity halványan
  const faded = event.source === 'activity' && event.status === 'done'

  return (
    <button
      onClick={() => onClick(event)}
      className={`w-full text-left rounded-lg border border-gray-200 border-l-4 ${meta.cardBorder} bg-white px-2.5 py-1.5 hover:shadow-sm transition-shadow ${faded ? 'opacity-55' : ''} ${isOverdue ? 'ring-1 ring-red-200' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium leading-tight text-gray-900 ${faded ? 'line-through decoration-gray-300' : ''} truncate`}>
            {event.title}
          </p>
          {event.subtitle && <p className="text-[11px] text-gray-500 truncate">{event.subtitle}</p>}
          {event.time && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <Clock size={9} /> {event.time}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
