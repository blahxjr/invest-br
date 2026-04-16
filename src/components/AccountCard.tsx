import { Wallet, Building2, FolderKanban, User } from 'lucide-react'

export interface AccountCardProps {
  name: string
  type: string
  institutionName?: string
  portfolioName?: string | null
  clientName?: string | null
  balance: number
  transactionCount?: number
}

const typeLabels: Record<string, string> = {
  BROKERAGE: 'Corretora',
  BANK: 'Banco',
  CRYPTO_WALLET: 'Cripto',
  REAL_ESTATE: 'Imóveis',
  MANUAL: 'Manual',
  BROKER: 'Corretora',
  CRYPTO_EXCHANGE: 'Exchange',
  REAL_ESTATE_FUND: 'Fundo Imobiliário',
  OTHER: 'Outro',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AccountCard({
  name,
  type,
  institutionName,
  portfolioName,
  clientName,
  balance,
  transactionCount,
}: AccountCardProps) {
  const label = typeLabels[type] ?? type

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Wallet size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      </div>

      {institutionName && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <Building2 size={12} />
          <span>{institutionName}</span>
        </div>
      )}

      {(portfolioName || clientName) && (
        <div className="space-y-1 mb-3">
          {portfolioName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <FolderKanban size={12} />
              <span>{portfolioName}</span>
            </div>
          )}
          {clientName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <User size={12} />
              <span>{clientName}</span>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-1">Saldo atual</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance)}</p>
        {transactionCount != null && (
          <p className="text-xs text-gray-400 mt-1">{transactionCount} movimentações</p>
        )}
      </div>
    </div>
  )
}
