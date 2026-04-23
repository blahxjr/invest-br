import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAccountAction } from './actions'

type EditAccountPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditAccountPage({ params }: EditAccountPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    notFound()
  }

  const { id } = await params

  const [account, institutions, portfolios] = await Promise.all([
    prisma.account.findFirst({
      where: {
        id,
        client: {
          userId: session.user.id,
        },
      },
      include: {
        institution: true,
      },
    }),
    prisma.institution.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.portfolio.findMany({
      where: { userId: session.user.id },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  if (!account) {
    notFound()
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/accounts" className="rounded-lg p-2 transition-colors hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Conta</h1>
          <p className="mt-1 text-sm text-gray-500">Atualize os dados de uma conta importada ou manual</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <form action={updateAccountAction} className="space-y-5">
          <input type="hidden" name="accountId" value={account.id} />

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nome da conta <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={account.name}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="institutionId" className="mb-1 block text-sm font-medium text-gray-700">
              Instituicao <span className="text-red-500">*</span>
            </label>
            <select
              id="institutionId"
              name="institutionId"
              required
              defaultValue={account.institutionId}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>{institution.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="portfolioId" className="mb-1 block text-sm font-medium text-gray-700">
              Portfolio
            </label>
            <select
              id="portfolioId"
              name="portfolioId"
              defaultValue={account.portfolioId ?? ''}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sem portfolio</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/accounts"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Salvar alteracoes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
