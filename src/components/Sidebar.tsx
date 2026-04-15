'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Landmark,
  TrendingUp,
  ArrowLeftRight,
  BarChart3,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Contas', icon: Wallet },
  { href: '/institutions', label: 'Instituições', icon: Landmark },
  { href: '/assets', label: 'Ativos', icon: TrendingUp },
  { href: '/transactions', label: 'Movimentações', icon: ArrowLeftRight },
  { href: '/positions', label: 'Posições', icon: BarChart3 },
  { href: '/performance', label: 'Rentabilidade', icon: TrendingUp },
  { href: '/import', label: 'Importar B3', icon: BarChart3 },
  { href: '/income', label: 'Proventos', icon: TrendingUp },
  { href: '/dashboard/insights/config', label: 'Regras Insights', icon: TrendingUp },
  { href: '/dashboard/insights/profiles', label: 'Perfis Insights', icon: TrendingUp },
]

type SidebarProps = {
  mobile?: boolean
  onNavigate?: () => void
}

export default function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 mt-6">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
            pathname === href
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      <aside
        className={clsx(
          'w-64 flex-col bg-white border-r border-gray-200 p-4 shrink-0',
          mobile ? 'flex' : 'hidden md:flex'
        )}
      >
        <div className="flex items-center gap-2 px-2 py-1">
          <TrendingUp size={24} className="text-blue-600" />
          <span className="text-lg font-bold text-gray-900">InvestBR</span>
        </div>
        <NavLinks />
      </aside>
    </>
  )
}
