import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAccountAction, getAccountFormData } from './actions'

const accountTypes = [
  { value: 'BROKERAGE', label: 'Corretora' },
  { value: 'BANK', label: 'Banco' },
  { value: 'CRYPTO_WALLET', label: 'Cripto' },
  { value: 'REAL_ESTATE', label: 'Imóvel' },
  { value: 'MANUAL', label: 'Manual' },
]

export default async function NewAccountPage() {
  const { institutions, portfolios } = await getAccountFormData()

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/accounts"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Conta</h1>
          <p className="text-sm text-gray-500">Adicione uma conta de investimento</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={createAccountAction} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da conta <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Ex: Conta XP, Conta BTG, Carteira BTC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              {accountTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="institutionId" className="block text-sm font-medium text-gray-700 mb-1">
              Instituição existente
            </label>
            <select
              id="institutionId"
              name="institutionId"
              defaultValue=""
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecionar instituição</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>{institution.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="institutionName" className="block text-sm font-medium text-gray-700 mb-1">
              Nova instituição (criação rápida)
            </label>
            <input
              id="institutionName"
              name="institutionName"
              type="text"
              placeholder="Ex: XP Investimentos, Nubank, Binance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se você selecionar uma instituição existente, este campo será ignorado.
            </p>
          </div>

          <div>
            <label htmlFor="portfolioId" className="block text-sm font-medium text-gray-700 mb-1">
              Portfólio
            </label>
            <select
              id="portfolioId"
              name="portfolioId"
              defaultValue=""
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Portfólio principal automático</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/accounts"
              className="flex-1 text-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
