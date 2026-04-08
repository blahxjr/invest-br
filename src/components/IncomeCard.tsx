import { DollarSign } from 'lucide-react'

export interface IncomeCardProps {
  type: string
  ticker?: string
  grossAmount: number
  netAmount: number
  paymentDate: string | Date
}

const typeLabels: Record<string, string> = {
  DIVIDEND: 'Dividendo',
  JCP: 'JCP',
  FII_RENT: 'Rendimento FII',
  COUPON: 'Cupom',
  RENTAL: 'Aluguel',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function IncomeCard({
  type,
  ticker,
  grossAmount,
  netAmount,
  paymentDate,
}: IncomeCardProps) {
  const label = typeLabels[type] ?? type
  const tax = grossAmount - netAmount

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-green-100 p-1.5 rounded-lg">
            <DollarSign size={16} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{label}</p>
            {ticker && <p className="text-xs text-gray-500">{ticker}</p>}
          </div>
        </div>
        <span className="text-xs text-gray-400">{formatDate(paymentDate)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Bruto</p>
          <p className="font-semibold text-gray-900">{formatCurrency(grossAmount)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Líquido</p>
          <p className="font-semibold text-green-600">{formatCurrency(netAmount)}</p>
        </div>
      </div>

      {tax > 0 && (
        <p className="mt-2 text-xs text-gray-400">IR retido: {formatCurrency(tax)}</p>
      )}
    </div>
  )
}
