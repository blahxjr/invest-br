export default function DebugImportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Debug Import B3</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ambiente de depuracao para importar planilhas da B3 e inspecionar resultados rapidamente.
        </p>
      </header>
      {children}
    </div>
  )
}
