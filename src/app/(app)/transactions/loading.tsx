import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={`tx-row-${index}`} className="h-10 w-full" />
      ))}
    </div>
  )
}