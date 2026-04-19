'use client'

import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import type {
  DebugAuditLogRow,
  DebugLedgerRow,
  DebugTransactionRow,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ResultsTableProps = {
  auditLogs: DebugAuditLogRow[]
  transactions: DebugTransactionRow[]
  ledger: DebugLedgerRow[]
}

type TabKey = 'audit' | 'transactions' | 'ledger'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const headerLine = headers.map(escape).join(',')
  const bodyLines = rows.map((row) => row.map((cell) => escape(cell)).join(','))
  return [headerLine, ...bodyLines].join('\n')
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function GenericTable<TData>({
  data,
  columns,
  emptyMessage,
}: {
  data: TData[]
  columns: Array<ColumnDef<TData, unknown>>
  emptyMessage: string
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ResultsTable({ auditLogs, transactions, ledger }: ResultsTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('audit')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')

  const filteredAudit = useMemo(
    () =>
      auditLogs.filter((row) => {
        const byType = typeFilter
          ? row.action.toLowerCase().includes(typeFilter.toLowerCase()) ||
            row.entity.toLowerCase().includes(typeFilter.toLowerCase())
          : true
        const byDate = dateFilter ? row.timestamp.slice(0, 10) === dateFilter : true
        return byType && byDate
      }),
    [auditLogs, typeFilter, dateFilter],
  )

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((row) => {
        const byType = typeFilter ? row.type.toLowerCase().includes(typeFilter.toLowerCase()) : true
        const byDate = dateFilter ? row.createdAt.slice(0, 10) === dateFilter : true
        const byAccount = accountFilter
          ? row.accountId.toLowerCase().includes(accountFilter.toLowerCase())
          : true
        return byType && byDate && byAccount
      }),
    [transactions, typeFilter, dateFilter, accountFilter],
  )

  const filteredLedger = useMemo(
    () =>
      ledger.filter((row) => {
        const byType = typeFilter ? row.entryType.toLowerCase().includes(typeFilter.toLowerCase()) : true
        const byDate = dateFilter ? row.timestamp.slice(0, 10) === dateFilter : true
        const byAccount = accountFilter
          ? row.accountId.toLowerCase().includes(accountFilter.toLowerCase())
          : true
        return byType && byDate && byAccount
      }),
    [ledger, typeFilter, dateFilter, accountFilter],
  )

  const auditColumn = createColumnHelper<DebugAuditLogRow>()
  const transactionColumn = createColumnHelper<DebugTransactionRow>()
  const ledgerColumn = createColumnHelper<DebugLedgerRow>()

  const auditColumns = useMemo<ColumnDef<DebugAuditLogRow, unknown>[]>(
    () => [
      auditColumn.accessor('id', { header: 'id' }),
      auditColumn.accessor('source', { header: 'source' }),
      auditColumn.accessor('action', { header: 'action' }),
      auditColumn.accessor('entity', { header: 'entity' }),
      auditColumn.accessor('timestamp', {
        header: 'timestamp',
        cell: (ctx) => formatDate(ctx.getValue()),
      }),
      auditColumn.accessor('userId', {
        header: 'userId',
        cell: (ctx) => ctx.getValue() ?? '-',
      }),
    ],
    [auditColumn],
  )

  const transactionColumns = useMemo<ColumnDef<DebugTransactionRow, unknown>[]>(
    () => [
      transactionColumn.accessor('id', { header: 'id' }),
      transactionColumn.accessor('accountId', { header: 'accountId' }),
      transactionColumn.accessor('type', { header: 'type' }),
      transactionColumn.accessor('quantity', {
        header: 'quantity',
        cell: (ctx) => ctx.getValue() ?? '-',
      }),
      transactionColumn.accessor('price', {
        header: 'price',
        cell: (ctx) => ctx.getValue() ?? '-',
      }),
      transactionColumn.accessor('total', { header: 'total' }),
      transactionColumn.accessor('notes', {
        header: 'notes',
        cell: (ctx) => ctx.getValue() ?? '-',
      }),
      transactionColumn.accessor('createdAt', {
        header: 'createdAt',
        cell: (ctx) => formatDate(ctx.getValue()),
      }),
    ],
    [transactionColumn],
  )

  const ledgerColumns = useMemo<ColumnDef<DebugLedgerRow, unknown>[]>(
    () => [
      ledgerColumn.accessor('id', { header: 'id' }),
      ledgerColumn.accessor('accountId', { header: 'accountId' }),
      ledgerColumn.accessor('balanceBefore', { header: 'balanceBefore' }),
      ledgerColumn.accessor('balanceAfter', { header: 'balanceAfter' }),
      ledgerColumn.accessor('entryType', { header: 'entryType' }),
      ledgerColumn.accessor('timestamp', {
        header: 'timestamp',
        cell: (ctx) => formatDate(ctx.getValue()),
      }),
    ],
    [ledgerColumn],
  )

  function handleExportCsv() {
    if (activeTab === 'audit') {
      const csv = toCsv(
        ['id', 'source', 'action', 'entity', 'timestamp', 'userId'],
        filteredAudit.map((row) => [
          row.id,
          row.source,
          row.action,
          row.entity,
          row.timestamp,
          row.userId ?? '',
        ]),
      )
      downloadCsv('debug-auditlog.csv', csv)
      return
    }

    if (activeTab === 'transactions') {
      const csv = toCsv(
        ['id', 'accountId', 'type', 'quantity', 'price', 'total', 'notes', 'createdAt'],
        filteredTransactions.map((row) => [
          row.id,
          row.accountId,
          row.type,
          row.quantity ?? '',
          row.price ?? '',
          row.total,
          row.notes ?? '',
          row.createdAt,
        ]),
      )
      downloadCsv('debug-transactions.csv', csv)
      return
    }

    const csv = toCsv(
      ['id', 'accountId', 'balanceBefore', 'balanceAfter', 'entryType', 'timestamp'],
      filteredLedger.map((row) => [
        row.id,
        row.accountId,
        row.balanceBefore,
        row.balanceAfter,
        row.entryType,
        row.timestamp,
      ]),
    )
    downloadCsv('debug-ledger.csv', csv)
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Resultados Técnicos</CardTitle>
          <Button onClick={handleExportCsv}>Export CSV</Button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            placeholder="Filtrar por tipo"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Filtrar por tipo"
          />
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Filtrar por data"
          />
          <input
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            placeholder="Filtrar por accountId"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Filtrar por accountId"
          />
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as TabKey)}>
          <TabsList>
            <TabsTrigger value="audit">AuditLog</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="audit">
            <GenericTable
              data={filteredAudit}
              columns={auditColumns}
              emptyMessage="Nenhum registro de AuditLog encontrado para os filtros atuais."
            />
          </TabsContent>

          <TabsContent value="transactions">
            <GenericTable
              data={filteredTransactions}
              columns={transactionColumns}
              emptyMessage="Nenhuma transaction encontrada para os filtros atuais."
            />
          </TabsContent>

          <TabsContent value="ledger">
            <GenericTable
              data={filteredLedger}
              columns={ledgerColumns}
              emptyMessage="Nenhum lançamento de ledger encontrado para os filtros atuais."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
