'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ContractRow { name: string; qty: number; value: number; isComponent: boolean }
interface ContractData {
  titleDe: string
  pre: string
  post: string
  rows: ContractRow[]
  addenda: { name: string; text: string }[]
  contractNumber: string
  totalValue: number
  companyName: string
}

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// A § kezdetű sorokat félkövéren, a többit normál bekezdésként.
function TextBlock({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} style={{ margin: 0, fontWeight: line.trimStart().startsWith('§') ? 700 : 400, minHeight: line.trim() ? undefined : '0.7em' }}>
          {line}
        </p>
      ))}
    </>
  )
}

export default function ContractPrintPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<ContractData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/asset-placements/${id}/contract`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: ContractData) => setData(d))
      .catch(() => setError(true))
  }, [id])

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [data])

  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>A szerződés nem tölthető be.</div>
  if (!data) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Betöltés…</div>

  return (
    <div className="contract-sheet">
      <style>{`
        @page { size: A4; margin: 20mm; }
        body { background: #f3f4f6; }
        .contract-sheet {
          max-width: 800px; margin: 24px auto; background: #fff; color: #111;
          padding: 32px 40px; font-family: Arial, Helvetica, sans-serif;
          font-size: 13px; line-height: 1.55; box-shadow: 0 1px 8px rgba(0,0,0,.08);
        }
        .contract-sheet h1 { text-align: center; font-size: 22px; margin: 0 0 20px; }
        .contract-sheet table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .contract-sheet th, .contract-sheet td { border: 1px solid #999; padding: 5px 8px; }
        .contract-sheet th { background: #f3f4f6; text-align: left; }
        .contract-sheet .num { text-align: right; white-space: nowrap; }
        .contract-sheet .ctr { text-align: center; }
        .addenda-title { font-weight: 700; margin: 20px 0 6px; }
        .addendum-name { font-weight: 700; margin: 10px 0 2px; }
        .print-hint { max-width: 800px; margin: 0 auto 12px; text-align: right; }
        @media print {
          body { background: #fff; }
          .contract-sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
          .print-hint { display: none; }
        }
      `}</style>

      <div className="print-hint">
        <button onClick={() => window.print()} style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          Nyomtatás / Mentés PDF-ként
        </button>
      </div>

      <h1>{data.titleDe}</h1>

      <TextBlock text={data.pre} />

      <table>
        <thead>
          <tr><th>Bezeichnung</th><th className="ctr">Menge</th><th className="num">Wert</th></tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td style={{ paddingLeft: row.isComponent ? 24 : 8 }}>{row.isComponent ? `– ${row.name}` : row.name}</td>
              <td className="ctr">{row.qty}</td>
              <td className="num">{euro(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TextBlock text={data.post} />

      {data.addenda.length > 0 && (
        <>
          <div className="addenda-title">Ergänzungen</div>
          {data.addenda.map((a, i) => (
            <div key={i}>
              <div className="addendum-name">{a.name}</div>
              <TextBlock text={a.text} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
