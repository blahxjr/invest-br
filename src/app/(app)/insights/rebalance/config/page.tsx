/**
 * Página de Configuração de Alocação Alvo
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import ConfigPageClient from './page-client'
import { AssetClassForRebalance } from '@/modules/insights/rebalance-types'

export default async function ConfigPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return <div>Não autenticado</div>
  }

  // Defaults usados quando não há configuração salva
  const fallbackTargets = [
    { assetClass: AssetClassForRebalance.RENDA_FIXA, targetPct: 40 },
    { assetClass: AssetClassForRebalance.ACOES, targetPct: 30 },
    { assetClass: AssetClassForRebalance.FIIS, targetPct: 20 },
    { assetClass: AssetClassForRebalance.CRYPTO, targetPct: 10 },
    { assetClass: AssetClassForRebalance.EXTERIOR, targetPct: 0 },
    { assetClass: AssetClassForRebalance.OUTROS, targetPct: 0 },
  ]

  const savedTargets = await prisma.allocationTarget.findMany({
    where: { userId: session.user.id },
  })

  const defaultTargets = fallbackTargets.map((fallbackTarget) => {
    const savedTarget = savedTargets.find((target) => target.assetClass === fallbackTarget.assetClass)
    if (!savedTarget) {
      return fallbackTarget
    }

    return {
      assetClass: fallbackTarget.assetClass,
      targetPct: new Decimal(savedTarget.targetPct.toString()).toNumber(),
    }
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho com voltar */}
      <div className="flex items-center gap-3">
        <Link
          href="/insights/rebalance"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
          <span className="text-sm text-gray-600">Voltar</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configurar Alocação Alvo</h1>
      </div>

      {/* Informação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900">ℹ️ Como funciona</h2>
        <p className="text-sm text-blue-800 mt-2">
          Defina o percentual alvo para cada classe de ativo. A soma deve totalizar 100%.
          O sistema utilizará esses dados para sugerir rebalanceamento quando a alocação atual se afastar mais de 5% do alvo.
        </p>
      </div>

      {/* Formulário */}
      <ConfigPageClient userId={session.user.id} defaultTargets={defaultTargets} />
    </div>
  )
}
