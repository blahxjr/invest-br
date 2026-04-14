import ImportPageClient from './import-page-client'

export default function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar B3</h1>
        <p className="text-sm text-gray-500 mt-1">
          Envie planilhas de negociacao, movimentacao e posicao para sincronizar sua carteira.
        </p>
      </div>

      <ImportPageClient />
    </div>
  )
}
