import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'InvestBR — Sua carteira de investimentos',
  description: 'Dashboard de investimentos para investidor brasileiro',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
