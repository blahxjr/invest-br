'use client'

import { useRouter } from 'next/navigation'
import type { AssetCategory } from '@prisma/client'
import { AssetEditDialog } from './AssetEditDialog'
import { AssetClassEditDialog } from './AssetClassEditDialog'
import { deleteAsset, deleteAssetClass, updateAsset, updateAssetClass } from '@/modules/assets/actions'

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

type AssetListProps = {
  assetClasses: Array<{
    id: string
    name: string
    description: string | null
    code: string | null
    assets: Array<{
      id: string
      ticker: string | null
      name: string
      category: AssetCategory
      assetClassId: string
    }>
  }>
}

export function AssetClassList({ assetClasses }: AssetListProps) {
  const router = useRouter()

  const handleUpdateAsset = async (
    assetId: string,
    data: { name: string; category: AssetCategory }
  ) => {
    await updateAsset(assetId, data)
    router.refresh()
  }

  const handleDeleteAsset = async (assetId: string) => {
    await deleteAsset(assetId)
    router.refresh()
  }

  const handleUpdateAssetClass = async (data: {
    id: string
    name: string
    description: string | null
  }) => {
    await updateAssetClass(data.id, { name: data.name, description: data.description ?? undefined })
    router.refresh()
  }

  const handleDeleteAssetClass = async (classId: string) => {
    await deleteAssetClass(classId)
    router.refresh()
  }

  return (
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
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {cls.assets.length} ativos
              </span>
              <AssetClassEditDialog
                assetClass={{
                  id: cls.id,
                  name: cls.name,
                  description: cls.description,
                  assetCount: cls.assets.length,
                }}
                onUpdate={handleUpdateAssetClass}
                onDelete={handleDeleteAssetClass}
              />
            </div>
          </div>

          {cls.assets.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhum ativo nesta classe.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {cls.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {asset.ticker && (
                      <span className="font-bold text-gray-900 w-20 text-sm">{asset.ticker}</span>
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
                    <AssetEditDialog
                      asset={asset}
                      onUpdate={(data) =>
                        handleUpdateAsset(data.id, {
                          name: data.name,
                          category: data.category as AssetCategory,
                        })
                      }
                      onDelete={handleDeleteAsset}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
