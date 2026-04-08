import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAccountsForUser, getAllAssets, createTransactionAction } from './actions'

const transactionTypes = [
  { value: 'BUY', label: 'Compra' },
  { value: 'SELL', label: 'Venda' },
  { value: 'DEPOSIT', label: 'Depósito' },
  { value: 'WITHDRAWAL', label: 'Retirada' },
  { value: 'DIVIDEND', label: 'Dividendo' },
  { value: 'INCOME', label: 'Rendimento' },
  { value: 'RENT', label: 'Aluguel' },
]

export default async function NewTransactionPage() {
  const [accounts, assets] = await Promise.all([
    getAccountsForUser(),
    getAllAssets(),
  ])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/transactions"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Transação</h1>
          <p className="text-sm text-gray-500">Registre uma movimentação</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-800">
          Você precisa criar uma conta antes de registrar transações.{' '}
          <Link href="/accounts/new" className="font-medium underline">
            Criar conta agora
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form action={createTransactionAction} className="space-y-5">
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
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}{acc.institution ? ` — ${acc.institution.name}` : ''}
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
                {transactionTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ticker" className="block text-sm font-medium text-gray-700 mb-1">
                Ativo (ticker)
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <input
                id="ticker"
                name="ticker"
                type="text"
                list="assets-list"
                placeholder="Ex: PETR4, KNRI11"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              <datalist id="assets-list">
                {assets.map((a) => (
                  <option key={a.id} value={a.ticker ?? ''}>
                    {a.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  Preço unitário (R$)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Valor total (R$) <span className="text-red-500">*</span>
              </label>
              <input
                id="totalAmount"
                name="totalAmount"
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={today}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Observações
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Notas ou referência da operação"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/transactions"
                className="flex-1 text-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
