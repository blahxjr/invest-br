import { Suspense } from 'react'
import { Plus, Tag } from 'lucide-react'
import { prisma } from '@/lib/prisma'

const categoryLabels: Record<string, string> = {
  STOCK: 'Ação',
  FII: 'FII',
  ETF: 'ETF',
  FIXED_INCOME: 'Renda Fixa',
  FUND: 'Fundo',
  CRYPTO: 'Cripto',
  METAL: 'Metal',
  REAL_ESTATE: 'Imóvel',
  CASH: 'Caixa',
}

const categoryColors: Record<string, string> = {
  STOCK: 'bg-blue-50 text-blue-700',
  FII: 'bg-green-50 text-green-700',
  ETF: 'bg-purple-50 text-purple-700',
  FIXED_INCOME: 'bg-yellow-50 text-yellow-700',
  FUND: 'bg-orange-50 text-orange-700',
  CRYPTO: 'bg-pink-50 text-pink-700',
  METAL: 'bg-gray-50 text-gray-700',
  REAL_ESTATE: 'bg-teal-50 text-teal-700',
  CASH: 'bg-emerald-50 text-emerald-700',
}

async function AssetsContent() {
  const assetClasses = await prisma.assetClass.findMany({
    include: {
      assets: { orderBy: { ticker: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const totalAssets = assetClasses.reduce((s, c) => s + c.assets.length, 0)

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
        <Tag size={18} className="text-blue-600" />
        <div>
          <p className="text-sm font-medium text-gray-900">{totalAssets} ativos cadastrados</p>
          <p className="text-xs text-gray-500">{assetClasses.length} classes de ativos</p>
        </div>
      </div>

      {assetClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhum ativo encontrado.</p>
          <p className="text-sm text-gray-400">Execute o seed para popular o catálogo.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {assetClasses.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                  {cls.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{cls.description}</p>
                  )}
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {cls.assets.length} ativos
                </span>
              </div>

              {cls.assets.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">
                  Nenhum ativo nesta classe.
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {cls.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {asset.ticker && (
                          <span className="font-bold text-gray-900 w-20 text-sm">
                            {asset.ticker}
                          </span>
                        )}
                        <span className="text-sm text-gray-600">{asset.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            categoryColors[asset.category] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {categoryLabels[asset.category] ?? asset.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function AssetsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-xl h-48" />
      ))}
    </div>
  )
}

export default function AssetsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ativos</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo de ativos e classes</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Plus size={16} />
            Nova Classe
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} />
            Novo Ativo
          </button>
        </div>
      </div>
      <Suspense fallback={<AssetsSkeleton />}>
        <AssetsContent />
      </Suspense>
    </div>
  )
}
