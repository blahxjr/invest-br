// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DebugMetrics } from '@/app/(app)/debug/import/components/DebugMetrics'
import { LogViewer } from '@/app/(app)/debug/import/components/LogViewer'
import { ResultsTable } from '@/app/(app)/debug/import/components/ResultsTable'

const URLMock = vi.hoisted(() => ({
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
}))

describe('DebugMetrics', () => {
  it('renderiza os 5 cards com valores corretos', () => {
    render(
      <DebugMetrics
        auditLogsToday={12}
        newTransactionsLastHour={8}
        positionsRecalculated={3}
        errorsFound={1}
        acceptedRecords={19}
        totalRecords={20}
      />,
    )

    expect(screen.getByTestId('metric-audit-logs')).toHaveTextContent('12')
    expect(screen.getByTestId('metric-transactions-hour')).toHaveTextContent('8')
    expect(screen.getByTestId('metric-positions-recalc')).toHaveTextContent('3')
    expect(screen.getByTestId('metric-errors-found')).toHaveTextContent('1')
    expect(screen.getByTestId('metric-success-rate')).toHaveTextContent('95.0%')
  })
})

describe('ResultsTable', () => {
  const auditRows = [
    {
      id: 'al-1',
      source: 'B3',
      action: 'CREATE',
      entity: 'IMPORT_B3_NEGOCIACAO',
      timestamp: '2026-04-19T10:00:00.000Z',
      userId: 'user-1',
    },
  ]

  const transactionRows = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      type: 'BUY',
      quantity: '10',
      price: '12.34',
      total: '123.40',
      notes: 'import debug',
      createdAt: '2026-04-19T10:05:00.000Z',
    },
  ]

  const ledgerRows = [
    {
      id: 'le-1',
      accountId: 'acc-1',
      balanceBefore: '1000.00',
      balanceAfter: '876.60',
      entryType: 'DEBIT',
      timestamp: '2026-04-19T10:06:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.stubGlobal('URL', URLMock)
    vi.clearAllMocks()
  })

  it('renderiza a aba AuditLog por padrao', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    expect(screen.getByText('IMPORT_B3_NEGOCIACAO')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'AuditLog' })).toHaveAttribute('aria-selected', 'true')
  })

  it('troca para Transactions e exibe dados', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }))
    expect(screen.getByText('import debug')).toBeInTheDocument()
  })

  it('troca para Ledger e exibe dados', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Ledger' }))
    expect(screen.getByText('876.60')).toBeInTheDocument()
  })

  it('filtra por tipo na aba Transactions', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={[...transactionRows, { ...transactionRows[0], id: 'tx-2', type: 'SELL' }]}
        ledger={ledgerRows}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }))
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'SELL' } })

    expect(screen.getByText('tx-2')).toBeInTheDocument()
    expect(screen.queryByText('tx-1')).not.toBeInTheDocument()
  })

  it('filtra por accountId na aba Transactions', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={[...transactionRows, { ...transactionRows[0], id: 'tx-2', accountId: 'acc-xyz' }]}
        ledger={ledgerRows}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }))
    fireEvent.change(screen.getByLabelText('Filtrar por accountId'), { target: { value: 'xyz' } })

    expect(screen.getByText('tx-2')).toBeInTheDocument()
    expect(screen.queryByText('tx-1')).not.toBeInTheDocument()
  })

  it('filtra por data na aba AuditLog', () => {
    render(
      <ResultsTable
        auditLogs={[...auditRows, { ...auditRows[0], id: 'al-2', timestamp: '2026-04-18T10:00:00.000Z' }]}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    fireEvent.change(screen.getByLabelText('Filtrar por data'), { target: { value: '2026-04-18' } })

    expect(screen.getByText('al-2')).toBeInTheDocument()
    expect(screen.queryByText('al-1')).not.toBeInTheDocument()
  })

  it('exporta CSV da aba ativa', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(URLMock.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URLMock.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('mostra empty state quando filtros removem todos os registros', () => {
    render(
      <ResultsTable
        auditLogs={auditRows}
        transactions={transactionRows}
        ledger={ledgerRows}
      />,
    )

    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'NAO_EXISTE' } })

    expect(
      screen.getByText('Nenhum registro de AuditLog encontrado para os filtros atuais.'),
    ).toBeInTheDocument()
  })
})

describe('LogViewer', () => {
  const logs = [
    {
      filename: 'negociacao.md',
      content: '# Debug Negociacao\n\n## Resumo\n- imported: 10\n- errors: 1\n\n## SQL\n```sql\nSELECT 1\n```',
    },
    {
      filename: 'movimentacao.md',
      content: '# Debug Movimentacao\n\n## Resumo\n- imported: 4',
    },
  ]

  beforeEach(() => {
    vi.stubGlobal('URL', URLMock)
    vi.clearAllMocks()
  })

  it('renderiza tabs por arquivo', () => {
    render(<LogViewer logs={logs} />)
    expect(screen.getByRole('tab', { name: 'negociacao.md' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'movimentacao.md' })).toBeInTheDocument()
  })

  it('troca de arquivo e mostra conteudo correspondente', () => {
    render(<LogViewer logs={logs} />)

    fireEvent.click(screen.getByRole('tab', { name: 'movimentacao.md' }))

    expect(screen.getByText('# Debug Movimentacao')).toBeInTheDocument()
    expect(screen.queryByText('# Debug Negociacao')).not.toBeInTheDocument()
  })

  it('quebra o markdown em secoes colapsaveis', () => {
    render(<LogViewer logs={logs} />)

    expect(screen.getByText('Resumo')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('aplica highlight basico em heading, lista e code fence', () => {
    render(<LogViewer logs={logs} />)

    expect(screen.getAllByTestId('log-line-heading').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('log-line-list-item').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('log-line-code-fence').length).toBeGreaterThan(0)
  })

  it('realiza download do arquivo ativo', () => {
    render(<LogViewer logs={logs} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    expect(URLMock.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URLMock.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('exibe mensagem quando nao ha logs', () => {
    render(<LogViewer logs={[]} />)
    expect(screen.getByText('Nenhum log markdown disponível.')).toBeInTheDocument()
  })
})
