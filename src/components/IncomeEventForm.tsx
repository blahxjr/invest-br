'use client'

import type { Account, Asset, Institution, IncomeType } from '@prisma/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { createIncomeEventAction } from '@/app/(app)/income/new/actions'

type AccountWithInstitution = Account & { institution: Institution }

const incomeTypes: Array<{ value: IncomeType; label: string }> = [
  { value: 'DIVIDEND', label: 'Dividendo' },
  { value: 'JCP', label: 'JCP' },
  { value: 'FII_RENT', label: 'Rendimento FII' },
  { value: 'COUPON', label: 'Cupom' },
  { value: 'RENTAL', label: 'Aluguel' },
]

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Registrando...' : 'Registrar Provento'}
    </button>
  )
}

type Props = {
  accounts: AccountWithInstitution[]
  assets: Asset[]
}

export default function IncomeEventForm({ accounts, assets }: Props) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/income"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Provento</h1>
          <p className="text-sm text-gray-500">Registre um recebimento de renda</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-800">
          Voce precisa criar uma conta antes de registrar proventos.{' '}
          <Link href="/accounts/new" className="font-medium underline">
            Criar conta agora
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form action={createIncomeEventAction} className="space-y-5">
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 mb-1">
                Conta <span className="text-red-500">*</span>
              </label>
              <select
                id="accountId"
                name="accountId"
                required
                defaultValue=""
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="" disabled>Selecione a conta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.institution.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue=""
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="" disabled>Selecione o tipo</option>
                {incomeTypes.map((incomeType) => (
                  <option key={incomeType.value} value={incomeType.value}>{incomeType.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="assetTicker" className="block text-sm font-medium text-gray-700 mb-1">
                Ativo (ticker)
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <input
                id="assetTicker"
                name="assetTicker"
                type="text"
                list="income-assets-list"
                placeholder="ex: PETR4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              <datalist id="income-assets-list">
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.ticker ?? ''}>
                    {asset.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                Data de pagamento <span className="text-red-500">*</span>
              </label>
              <input
                id="paymentDate"
                name="paymentDate"
                type="date"
                required
                defaultValue={today}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="grossAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Valor bruto (R$) <span className="text-red-500">*</span>
              </label>
              <input
                id="grossAmount"
                name="grossAmount"
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="taxAmount" className="block text-sm font-medium text-gray-700 mb-1">
                IR Retido (opcional)
              </label>
              <input
                id="taxAmount"
                name="taxAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Observacoes
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Detalhes adicionais do provento"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/income"
                className="flex-1 text-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
              <SubmitButton />
            </div>
          </form>
        </div>
      )}
    </div>
  )
}