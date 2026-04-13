'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await signIn('nodemailer', {
        email: email.trim().toLowerCase(),
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (res?.error) {
        setError('Não foi possível enviar o link. Tente novamente.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="bg-green-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail size={24} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Verifique seu e-mail</h2>
        <p className="text-gray-500 text-sm">
          Enviamos um link mágico para{' '}
          <span className="font-medium text-gray-700">{email}</span>.
          Clique no link para entrar.
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Não recebeu? Verifique a pasta de spam.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Usar outro e-mail
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Entrar no InvestBR</h1>
      <p className="text-sm text-gray-500 mb-6">
        Informe seu e-mail para receber um link de acesso.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Mail size={16} />
              Enviar link de acesso
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        Sem senha — acesso por e-mail seguro (magic link).
      </p>
    </div>
  )
}
