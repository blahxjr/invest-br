"use client"

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const isDebugImportRoute = pathname?.startsWith('/debug/import')

  if (isDebugImportRoute) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">{children}</div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          <span className="font-bold text-gray-900">InvestBR</span>
        </div>
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-64" onClick={(event) => event.stopPropagation()}>
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
