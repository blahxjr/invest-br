import { TrendingUp } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp size={28} className="text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">InvestBR</span>
        </div>
        {children}
      </div>
    </div>
  )
}
