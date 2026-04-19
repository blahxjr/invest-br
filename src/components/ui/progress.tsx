import { cn } from '@/lib/utils'

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-200', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}>
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${safe}%` }} />
    </div>
  )
}
