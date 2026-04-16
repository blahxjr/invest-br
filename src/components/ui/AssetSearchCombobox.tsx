'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type AssetOption = {
  id: string
  ticker: string | null
  name: string
  className: string
}

export type AssetSearchComboboxProps = {
  assets: AssetOption[]
  value: string | null
  onChange: (assetId: string) => void
  placeholder?: string
}

export function AssetSearchCombobox({
  assets,
  value,
  onChange,
  placeholder = 'Buscar por ticker ou nome...',
}: AssetSearchComboboxProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === value) ?? null,
    [assets, value],
  )

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return assets.slice(0, 20)

    return assets
      .filter((asset) => {
        const ticker = (asset.ticker ?? '').toLowerCase()
        const name = asset.name.toLowerCase()
        return ticker.includes(term) || name.includes(term)
      })
      .slice(0, 20)
  }, [assets, query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return
      if (!(event.target instanceof Node)) return
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {selectedAsset && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onChange('')
            }}
            className="rounded-md border border-gray-300 px-2 py-2 text-xs font-medium text-gray-600"
            aria-label="Limpar seleção"
          >
            X
          </button>
        )}
      </div>

      {selectedAsset && (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Selecionado: <strong>{selectedAsset.ticker ?? 'SEM TICKER'}</strong> - {selectedAsset.name}
        </div>
      )}

      {isOpen && filteredAssets.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filteredAssets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                onChange(asset.id)
                setQuery(asset.ticker ?? asset.name)
                setIsOpen(false)
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
            >
              <span>
                <strong>{asset.ticker ?? 'SEM TICKER'}</strong> - {asset.name}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{asset.className}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
