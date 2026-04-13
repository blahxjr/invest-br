import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InsightRulesForm } from '@/components/InsightRulesForm'
import {
  assignClientProfileAction,
  assignPortfolioProfileAction,
  createProfileAction,
  deleteProfileAction,
  getProfilesPageDataAction,
  renameProfileAction,
  saveProfileRulesAction,
} from './actions'

export default async function InsightsProfilesPage() {
  const { profiles, clients, portfolios, catalog } = await getProfilesPageDataAction()

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/insights"
          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perfis de Insights</h1>
          <p className="text-sm text-gray-500">
            Crie perfis de configuração para atribuir a clientes e carteiras.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Novo perfil
        </h2>
        <form action={createProfileAction} className="flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            type="text"
            required
            placeholder="Ex: Perfil Conservador"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Criar perfil
          </button>
        </form>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
          Nenhum perfil criado ainda.
        </div>
      ) : (
        profiles.map((profile: (typeof profiles)[number]) => {
          const profileRules = catalog.map((item: (typeof catalog)[number]) => {
            const rule = profile.rules.find((r: (typeof profile.rules)[number]) => r.insightType.code === item.code)
            return {
              code: item.code,
              label: item.label,
              description: item.description,
              enabled: rule?.enabled ?? true,
              threshold: (rule?.thresholdOverride ?? item.defaultThreshold).toNumber(),
              defaultThreshold: item.defaultThreshold.toNumber(),
            }
          })

          return (
            <div key={profile.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-xs text-gray-500">Escopo base: {profile.scope}</p>
                </div>

                <form action={deleteProfileAction}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Excluir perfil
                  </button>
                </form>
              </div>

              <form action={renameProfileAction} className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="profileId" value={profile.id} />
                <input
                  name="name"
                  defaultValue={profile.name}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Renomear
                </button>
              </form>

              <InsightRulesForm
                rules={profileRules}
                action={saveProfileRulesAction}
                profileId={profile.id}
                submitLabel="Salvar regras do perfil"
              />

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-100 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Atribuir a cliente</h4>
                  <form action={assignClientProfileAction} className="space-y-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <select
                      name="clientId"
                      required
                      defaultValue=""
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="" disabled>Selecione um cliente</option>
                      {clients.map((client: (typeof clients)[number]) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                          {client.insightConfigProfileId === profile.id ? ' (atribuído)' : ''}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white">
                      Atribuir cliente
                    </button>
                  </form>
                </div>

                <div className="rounded-lg border border-gray-100 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Atribuir a carteira</h4>
                  <form action={assignPortfolioProfileAction} className="space-y-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <select
                      name="portfolioId"
                      required
                      defaultValue=""
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="" disabled>Selecione uma carteira</option>
                      {portfolios.map((portfolio: (typeof portfolios)[number]) => (
                        <option key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                          {portfolio.insightConfigProfileId === profile.id ? ' (atribuído)' : ''}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white">
                      Atribuir carteira
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
