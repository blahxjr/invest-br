import { Wallet, Building2 } from 'lucide-react'

export interface AccountCardProps {
  name: string
  type: string
  institutionName?: string
  balance: number
  transactionCount?: number
}

const typeLabels: Record<string, string> = {
  BROKERAGE: 'Corretora',
  BANK: 'Banco',
  CRYPTO_WALLET: 'Cripto',
  REAL_ESTATE: 'Imóveis',
  MANUAL: 'Manual',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AccountCard({
  name,
  type,
  institutionName,
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
