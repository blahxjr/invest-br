'use client'

export interface AllocationChartItem {
  category: string
  value: string      // Decimal serializado como string (ex: "21300.00")
  percentage: string // Decimal serializado como string (ex: "45.2")
}

interface Props {
  items: AllocationChartItem[]
}

const CATEGORY_COLORS: Record<string, string> = {
  STOCK: '#3b82f6',
  FII: '#22c55e',
  ETF: '#eab308',
  BDR: '#a855f7',
}

function getColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#94a3b8'
}

function formatCurrencyCompact(value: string): string {
  const n = parseFloat(value)
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`
  return `R$ ${n.toFixed(2)}`
}

interface DonutSegment {
  category: string
  percentage: number
  color: string
  startAngle: number
  endAngle: number
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle)
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export default function AllocationChart({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Alocação por Categoria</h3>
        <p className="text-sm text-gray-500 text-center py-8">Sem posições para exibir.</p>
      </div>
    )
  }

  const cx = 80
  const cy = 80
  const outerR = 68
  const innerR = 42

  const startOffset = -Math.PI / 2 // Começa no topo

  const segments: DonutSegment[] = []
  let currentAngle = startOffset

  for (const item of items) {
    const pct = parseFloat(item.percentage)
    const angle = (pct / 100) * 2 * Math.PI
    segments.push({
      category: item.category,
      percentage: pct,
      color: getColor(item.category),
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    })
    currentAngle += angle
  }

  const top3Items = items.slice(0, 3)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Alocação por Categoria</h3>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-[auto,1fr] items-center gap-6">
        {/* Donut SVG */}
        <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
          {segments.map((seg) => (
            <path
              key={seg.category}
              d={describeArc(cx, cy, outerR, innerR, seg.startAngle, seg.endAngle)}
              fill={seg.color}
            />
          ))}
        </svg>

        {/* Legenda */}
        <div className="flex flex-col gap-2 min-w-0">
          {items.map((item) => (
            <div key={item.category} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: getColor(item.category) }}
              />
              <span className="font-medium text-gray-700 w-12 shrink-0">{item.category}</span>
              <span className="text-gray-500 w-12 text-right shrink-0">{item.percentage}%</span>
              <span className="text-gray-400 text-xs">{formatCurrencyCompact(item.value)}</span>
            </div>
          ))}
        </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Top 3 por categoria
          </p>
          <div className="grid grid-cols-1 gap-1 text-sm text-gray-700">
            {top3Items.map((item) => (
              <div key={`top-${item.category}`} className="flex items-center justify-between gap-3">
                <span className="font-medium">{item.category}</span>
                <span className="text-gray-500">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
