import { Mail } from 'lucide-react'
import Link from 'next/link'

export default function VerifyRequestPage() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
      <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail size={24} className="text-blue-600" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Link enviado!</h1>
      <p className="text-gray-500 text-sm mb-6">
        Verifique sua caixa de entrada e clique no link para acessar o InvestBR.
        O link expira em 24 horas.
      </p>
      <Link
        href="/login"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Voltar para o login
      </Link>
    </div>
  )
}
