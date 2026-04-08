import { Suspense } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'

const typeLabels: Record<string, string> = {
  BUY: 'Compra',
  SELL: 'Venda',
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Retirada',
  DIVIDEND: 'Dividendo',
  INCOME: 'Rendimento',
  RENT: 'Aluguel',
}

const typeColors: Record<string, string> = {
  BUY: 'bg-blue-50 text-blue-700',
  SELL: 'bg-purple-50 text-purple-700',
  DEPOSIT: 'bg-green-50 text-green-700',
  WITHDRAWAL: 'bg-red-50 text-red-700',
  DIVIDEND: 'bg-yellow-50 text-yellow-700',
  INCOME: 'bg-teal-50 text-teal-700',
  RENT: 'bg-orange-50 text-orange-700',
}

function formatCurrency(value: { toString(): string } | null) {
  if (!value) return '—'
  return parseFloat(value.toString()).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

async function TransactionsContent() {
  const portfolio = await prisma.portfolio.findFirst({
    include: { accounts: true },
  })

  if (!portfolio) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        Nenhum portfólio encontrado.
      </div>
    )
  }

  const accountIds = portfolio.accounts.map((a) => a.id)

  const transactions = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds } },
    include: {
      asset: { select: { ticker: true, name: true } },
      account: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })

  return (
    <>
      {transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Nenhuma movimentação encontrada.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ativo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Conta</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preço</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {typeLabels[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tx.asset?.ticker ?? '—'}
                      {tx.asset?.name && (
                        <span className="block text-xs text-gray-400 font-normal">{tx.asset.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tx.account.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {tx.quantity ? parseFloat(tx.quantity.toString()).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(tx.price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(tx.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="bg-gray-200 rounded-xl h-64 animate-pulse" />
  )
}

export default function TransactionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimentações</h1>
          <p className="text-sm text-gray-500 mt-1">Histórico de transações (últimas 50)</p>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <ArrowLeftRight size={16} />
          <span className="text-sm">Ledger</span>
        </div>
      </div>
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </div>
  )
}
