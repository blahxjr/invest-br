/**
 * Página Principal de Rebalanceamento
 */

import Link from 'next/link'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { calculateRebalance } from '@/modules/insights/rebalance-service'
import { generateAlerts } from '@/modules/insights/alerts-service'
import RebalancePageClient from './page-client'

export const metadata: Metadata = {
  title: 'Rebalanceamento | Invest BR',
}

export default async function RebalancePage() {
  const session = await auth()
  if (!session?.user?.id) {
    return <div>Não autenticado</div>
  }

  try {
    const [rebalanceResult, alerts] = await Promise.all([
      calculateRebalance(session.user.id),
      generateAlerts(session.user.id),
    ])

    return (
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rebalanceamento de Carteira</h1>
          <p className="text-gray-600 mt-2">
            Análise de alocação e sugestões de rebalanceamento
          </p>
        </div>

        {/* Componente cliente */}
        <RebalancePageClient rebalanceResult={rebalanceResult} alerts={alerts} />

        {/* Link para configuração */}
        <div className="flex justify-center pt-4">
          <Link
            href="/insights/rebalance/config"
            className="w-full sm:w-auto text-center text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Configurar alocação alvo →
          </Link>
        </div>
      </div>
    )
  } catch {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Erro ao carregar dados de rebalanceamento
      </div>
    )
  }
}
