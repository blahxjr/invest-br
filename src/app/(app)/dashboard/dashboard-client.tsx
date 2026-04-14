'use client'

import AllocationChart from '@/components/AllocationChart'
import type { AllocationChartItem } from '@/components/AllocationChart'

interface Props {
  items: AllocationChartItem[]
}

/**
 * Client Component que encapsula o gráfico de alocação do dashboard.
 * Recebe dados já serializados (sem Decimal) do Server Component.
 */
export default function DashboardClient({ items }: Props) {
  return <AllocationChart items={items} />
}
