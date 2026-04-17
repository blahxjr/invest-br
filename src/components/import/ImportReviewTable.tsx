'use client'

import { useMemo, useState } from 'react'

export type ImportReviewStatus = 'OK' | 'REVISAR' | 'IGNORAR'
export type ImportReviewAction = 'IMPORT' | 'SKIP'

export type ImportReviewTableLine = {
  id: string
  status: ImportReviewStatus
  reason: string
  action: ImportReviewAction
  type?: string
  ticker?: string
  instituicao?: string
  conta?: string
  original: Record<string, string>
  normalized: Record<string, string | number | null>
}

type ImportReviewTableProps = {
  title: string
  lines: ImportReviewTableLine[]
  onLineChange: (id: string, patch: Partial<ImportReviewTableLine>) => void
  institutionFilter?: string
  onInstitutionFilterChange?: (value: string) => void
}

function stringValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).sort()
}

export function ImportReviewTable({ title, lines, onLineChange, institutionFilter, onInstitutionFilterChange }: ImportReviewTableProps) {
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ImportReviewStatus>('TODOS')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [institutionFilterInternal, setInstitutionFilterInternal] = useState('TODOS')
  const [accountFilter, setAccountFilter] = useState('TODOS')
  const resolvedInstitutionFilter = institutionFilter ?? institutionFilterInternal

  const types = useMemo(() => uniqueValues(lines.map((line) => line.type)), [lines])
  const institutions = useMemo(() => uniqueValues(lines.map((line) => line.instituicao)), [lines])
  const accounts = useMemo(() => uniqueValues(lines.map((line) => line.conta)), [lines])

  const filteredLines = useMemo(() => lines.filter((line) => {
    if (statusFilter !== 'TODOS' && line.status !== statusFilter) return false
    if (typeFilter !== 'TODOS' && (line.type ?? '') !== typeFilter) return false
    if (resolvedInstitutionFilter !== 'TODOS' && (line.instituicao ?? '') !== resolvedInstitutionFilter) return false
    if (accountFilter !== 'TODOS' && (line.conta ?? '') !== accountFilter) return false
    return true
  }), [lines, statusFilter, typeFilter, resolvedInstitutionFilter, accountFilter])

  const summary = useMemo(() => ({
    total: lines.length,
    ok: lines.filter((line) => line.status === 'OK').length,
    revisar: lines.filter((line) => line.status === 'REVISAR').length,
    ignorar: lines.filter((line) => line.status === 'IGNORAR').length,
    importar: lines.filter((line) => line.action === 'IMPORT').length,
    pular: lines.filter((line) => line.action === 'SKIP').length,
  }), [lines])

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <p className="font-semibold">{title}</p>
        <p>Total: {summary.total} | OK: {summary.ok} | REVISAR: {summary.revisar} | IGNORAR: {summary.ignorar}</p>
        <p>Selecionadas para importar: {summary.importar} | Ignoradas: {summary.pular}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'TODOS' | ImportReviewStatus)}>
          <option value="TODOS">Status: Todos</option>
          <option value="OK">Status: OK</option>
          <option value="REVISAR">Status: REVISAR</option>
          <option value="IGNORAR">Status: IGNORAR</option>
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="TODOS">Tipo: Todos</option>
          {types.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={resolvedInstitutionFilter}
          onChange={(event) => {
            const nextValue = event.target.value
            onInstitutionFilterChange?.(nextValue)
            if (!onInstitutionFilterChange) {
              setInstitutionFilterInternal(nextValue)
            }
          }}
        >
          <option value="TODOS">Instituição: Todas</option>
          {institutions.map((institution) => (
            <option key={institution} value={institution}>{institution}</option>
          ))}
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
          <option value="TODOS">Conta: Todas</option>
          {accounts.map((account) => (
            <option key={account} value={account}>{account}</option>
          ))}
        </select>
      </div>

      <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Motivo</th>
              <th className="p-2 text-left">Ação</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Ticker</th>
              <th className="p-2 text-left">Instituição</th>
              <th className="p-2 text-left">Conta</th>
              <th className="p-2 text-left">Originais</th>
              <th className="p-2 text-left">Normalizados</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((line) => (
              <tr key={line.id} className="border-t border-gray-100 align-top">
                <td className="p-2 text-xs font-semibold">{line.status}</td>
                <td className="p-2 text-xs text-amber-700">{line.reason}</td>
                <td className="p-2">
                  <select className="rounded-md border border-gray-300 px-2 py-1" value={line.action} onChange={(event) => onLineChange(line.id, { action: event.target.value as ImportReviewAction })}>
                    <option value="IMPORT">IMPORTAR</option>
                    <option value="SKIP">IGNORAR</option>
                  </select>
                </td>
                <td className="p-2">
                  <input className="w-24 rounded-md border border-gray-300 px-2 py-1" value={stringValue(line.type)} onChange={(event) => onLineChange(line.id, { type: event.target.value })} />
                </td>
                <td className="p-2">
                  <input className="w-24 rounded-md border border-gray-300 px-2 py-1" value={stringValue(line.ticker)} onChange={(event) => onLineChange(line.id, { ticker: event.target.value.toUpperCase() })} />
                </td>
                <td className="p-2">
                  <input className="w-36 rounded-md border border-gray-300 px-2 py-1" value={stringValue(line.instituicao)} onChange={(event) => onLineChange(line.id, { instituicao: event.target.value.toUpperCase() })} />
                </td>
                <td className="p-2">
                  <input className="w-28 rounded-md border border-gray-300 px-2 py-1" value={stringValue(line.conta)} onChange={(event) => onLineChange(line.id, { conta: event.target.value })} />
                </td>
                <td className="p-2 text-xs">
                  <details>
                    <summary className="cursor-pointer text-blue-700">ver</summary>
                    <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-600">{JSON.stringify(line.original, null, 2)}</pre>
                  </details>
                </td>
                <td className="p-2 text-xs">
                  <details>
                    <summary className="cursor-pointer text-blue-700">ver</summary>
                    <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-600">{JSON.stringify(line.normalized, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
