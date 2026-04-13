import { Building2, Plus } from 'lucide-react'
import { InstitutionType } from '@prisma/client'
import { listInstitutions } from '@/modules/institutions/service'
import { createInstitutionAction, updateInstitutionAction } from './actions'

const institutionTypes = [
  { value: 'BROKER', label: 'Corretora' },
  { value: 'BANK', label: 'Banco' },
  { value: 'CRYPTO_EXCHANGE', label: 'Exchange Cripto' },
  { value: 'REAL_ESTATE_FUND', label: 'Imobiliária / Fundo Imobiliário' },
  { value: 'OTHER', label: 'Outro' },
] as const

function formatInstitutionType(type: InstitutionType | null) {
  return institutionTypes.find((item) => item.value === type)?.label ?? 'Não informado'
}

export default async function InstitutionsPage() {
  const institutions = await listInstitutions()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Instituições</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre e edite bancos, corretoras e demais instituições.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Nova instituição</h2>
        </div>

        <form action={createInstitutionAction} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="institution-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              id="institution-name"
              name="name"
              type="text"
              required
              placeholder="Ex: XP Investimentos"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="institution-type" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              id="institution-type"
              name="type"
              defaultValue=""
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Não informado</option>
              {institutionTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-10 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Salvar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Building2 size={16} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Instituições cadastradas</h2>
        </div>

        {institutions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            Nenhuma instituição cadastrada até o momento.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {institutions.map((institution) => (
              <form
                key={institution.id}
                action={updateInstitutionAction}
                className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
              >
                <input type="hidden" name="id" value={institution.id} />

                <div className="lg:col-span-5">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={institution.name}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                  <select
                    name="type"
                    defaultValue={institution.type ?? ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Não informado</option>
                    {institutionTypes.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2 text-xs text-gray-500">
                  Atual: {formatInstitutionType(institution.type)}
                </div>

                <button
                  type="submit"
                  className="lg:col-span-1 h-10 px-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Editar
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}