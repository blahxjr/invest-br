'use client'

import PatrimonyChart, { type PatrimonyChartPoint } from '@/components/PatrimonyChart'

type Props = {
  snapshots: PatrimonyChartPoint[]
}

export default function PerformancePatrimonyChart({ snapshots }: Props) {
  return <PatrimonyChart snapshots={snapshots} />
}
