'use client'

import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import MessageGeneratorModal from './MessageGeneratorModal'

interface TemplateType {
  id: string
  label: string
  icon: string
}

interface CommTemplate {
  id: string
  name: string
  typeId: string
  type: TemplateType
  subject: string | null
  bodyHu: string
  description: string | null
  isActive: boolean
}

interface TemplatesTabProps {
  companyId?: string
  contactId?: string
}

export default function TemplatesTab({ companyId, contactId }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then((data: CommTemplate[]) => {
        setTemplates(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Betöltés...</div>
  }

  if (templates.length === 0) {
    return (
      <div className="py-12 text-center">
        <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Nincs sablon. Hozz létre egyet a Beállítások / Kommunikáció menüpontban.</p>
      </div>
    )
  }

  // Group by type
  const grouped = templates.reduce<Record<string, CommTemplate[]>>((acc, tmpl) => {
    const key = tmpl.typeId
    if (!acc[key]) acc[key] = []
    acc[key].push(tmpl)
    return acc
  }, {})

  return (
    <>
      <div className="space-y-6">
        {Object.entries(grouped).map(([typeId, group]) => {
          const typeInfo = group[0].type
          return (
            <div key={typeId}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{typeInfo.icon}</span>
                <h3 className="text-sm font-semibold text-gray-700">{typeInfo.label}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className="text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                      {tmpl.name}
                    </p>
                    {tmpl.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tmpl.description}</p>
                    )}
                    {!tmpl.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tmpl.bodyHu.slice(0, 80)}...</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {selectedTemplateId && (
        <MessageGeneratorModal
          templateId={selectedTemplateId}
          companyId={companyId}
          contactId={contactId}
          onClose={() => setSelectedTemplateId(null)}
        />
      )}
    </>
  )
}
