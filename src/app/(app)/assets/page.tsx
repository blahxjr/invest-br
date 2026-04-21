
import { Suspense } from 'react'
import { Plus, Tag } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCanonicalAssetClassMeta } from '@/modules/b3/normalization'
import { AssetClassList } from '@/components/AssetClassList'

async function AssetsContent() {
  const assetClasses = await prisma.assetClass.findMany({
    include: {
      assets: { orderBy: { ticker: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  // Deduplicate by semantic key
  const classBySemanticKey = new Map<
    string,
    { class: (typeof assetClasses)[0]; allAssets: (typeof assetClasses)[0]['assets'] }
  >()

  for (const cls of assetClasses) {
    const canonical = getCanonicalAssetClassMeta({
      code: cls.code,
      name: cls.name,
    })

    const semanticKey = canonical?.semanticKey ?? cls.id
    const existing = classBySemanticKey.get(semanticKey)

    if (!existing) {
      classBySemanticKey.set(semanticKey, {
        class: cls,
        allAssets: [...cls.assets],
      })
    } else {
      // Merge assets from duplicate class into canonical
      existing.allAssets.push(...cls.assets)
      // Keep the class with code if available
      if (cls.code && !existing.class.code) {
        existing.class = cls
      } else if (!existing.class.code && !cls.code && cls.createdAt < existing.class.createdAt) {
        // Keep older class if both have no code
        existing.class = cls
      }
    }
  }

  // Convert to array and sort
  const deduplicatedClasses = Array.from(classBySemanticKey.values())
    .map((entry) => ({
      ...entry.class,
      assets: entry.allAssets.sort((a, b) => (a.ticker ?? '').localeCompare(b.ticker ?? '')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalAssets = deduplicatedClasses.reduce((s, c) => s + c.assets.length, 0)

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
        <Tag size={18} className="text-blue-600" />
        <div>
          <p className="text-sm font-medium text-gray-900">{totalAssets} ativos cadastrados</p>
          <p className="text-xs text-gray-500">{deduplicatedClasses.length} classes de ativos</p>
        </div>
      </div>

      {deduplicatedClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhum ativo encontrado.</p>
          <p className="text-sm text-gray-400">Execute o seed para popular o catálogo.</p>
        </div>
      ) : (
        <AssetClassList assetClasses={deduplicatedClasses} />
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
