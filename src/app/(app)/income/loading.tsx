import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={`income-row-${index}`} className="h-10 w-full" />
      ))}
    </div>
  )
}