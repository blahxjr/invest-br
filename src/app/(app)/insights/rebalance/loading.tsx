import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={`rebalance-row-${index}`} className="h-10 w-full" />
      ))}
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`rebalance-alert-${index}`} className="h-20 w-full" />
      ))}
    </div>
  )
}