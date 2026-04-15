# Prompt 14 — Plano de Decomposição ✅

**Demanda:** Filtros de transações client-side por período, ativo e tipo  
**Status:** Planner completou decomposição estruturada  
**Tempo estimado:** 5h 15min para implementação completa

---

## 📋 Visão Geral do Plano

### Arquitetura Alvo
```
Server Component: carrega 500 transações + serializa Decimal → string
              ↓
Client Component: filtra em memória (useMemo)
              ↓
<TransactionFilters>: 3 inputs (DateRange + AssetSelect + TypeSelect)
              ↓
Tabela com contador: "X de Y movimentação(ões)"
```

### 6 Subtarefas Estruturadas

| # | Tarefa | Arquivo(s) | Tempo | Status |
|---|--------|-----------|-------|--------|
| 1 | Análise de UI | - | 30min | 🔜 TODO |
| 2 | `TransactionFilters` component | `src/components/TransactionFilters.tsx` | 1h | 🔜 TODO |
| 3 | Page refactor (Server+Client split) | `src/app/(app)/transactions/page.tsx` + `page-client.tsx` | 45min | 🔜 TODO |
| 4 | Testes de componente (5 testes) | `__tests__/components/TransactionFilters.test.tsx` | 1h | 🔜 TODO |
| 5 | Testes integração (6 testes) | `__tests__/app/transactions-filters.test.tsx` | 1h | 🔜 TODO |
| 6 | Documentação | `docs/modules/transactions.md` + `memory/` | 30min | 🔜 TODO |

---

## 🎯 Critério de Aceitação (DoD)

- ✅ **124 testes ainda passando** (sem regressão)
- ✅ **Build limpo** — TypeScript sem errors
- ✅ **Filtros funcionam**:
  - Isoladamente: data, ativo, tipo
  - Combinados: data + ativo + tipo
- ✅ **Performance**: useMemo otimiza recálculos
- ✅ **UI responsiva**: Tailwind v4, mobile-first
- ✅ **Serialização**: Decimal → string no boundary
- ✅ **11 novos testes** com boa cobertura
- ✅ **Documentação**: docs/ + memory/ atualizados
- ✅ **Commit estruturado** em pt-BR

---

## 📁 Arquivos a Criar/Modificar

### Criar (3 arquivos)
```
src/app/(app)/transactions/page-client.tsx       [Client Component com filtro]
src/components/TransactionFilters.tsx            [UI component reutilizável]
__tests__/components/TransactionFilters.test.tsx [5 testes de componente]
__tests__/app/transactions-filters.test.tsx      [6 testes integração]
```

### Modificar (2 arquivos)
```
src/app/(app)/transactions/page.tsx              [Server → Server+Client split]
docs/modules/transactions.md                     [Adicionar seção "Filtros v2"]
```

### Atualizar (1 arquivo)
```
memory/current-state.md                          [Status v2 com filtros]
```

---

## 🔧 Detalhes Técnicos

### Componente `<TransactionFilters>`
```tsx
// Props
type TransactionFiltersProps = {
  assets: Array<{ id: string; ticker: string; name: string }>
  onFilterChange: (filters: {
    startDate: Date | null
    endDate: Date | null
    assetId: string | null
    transactionType: string | null
  }) => void
}

// Renderiza
- DateRange: <input type="date"> (De / Até)
- AssetSelect: <select> com assets (default: "Todos os ativos")
- TypeSelect: <select> com tipos (BUY, SELL, DEPOSIT, etc.)
- ResetButton: limpa todos os filtros de uma vez
```

### `TransactionsPageClient` (Client Component)
```tsx
'use client'

export default function TransactionsPageClient({
  initialTransactions,  // 500 transações (serializado)
  assets
}) {
  const [filters, setFilters] = useState(...)
  
  const filteredTransactions = useMemo(() => {
    // Filtra por startDate, endDate, assetId, transactionType
    // O(n) linear
  }, [initialTransactions, filters])
  
  return (
    <div className="space-y-6">
      <TransactionFilters assets={assets} onFilterChange={setFilters} />
      <TransactionsTable transactions={filteredTransactions} />
      <Counter>{filteredTransactions.length} de {initialTransactions.length}</Counter>
    </div>
  )
}
```

### Serialização no `page.tsx`
```ts
// Server Component
const transactions = await prisma.transaction.findMany({ take: 500 })

// Serializar Decimal → string para Client
const serialized = transactions.map(tx => ({
  ...tx,
  quantity: tx.quantity?.toString() ?? null,
  price: tx.price?.toString() ?? null,
  totalAmount: tx.totalAmount.toString(),
}))

// Passar para Client
redirect <TransactionsPageClient initialTransactions={serialized} assets={assets} />
```

---

## 📚 Referências Existentes

- **Padrão client-side filtering**: `/src/app/(app)/performance/performance-page-client.tsx`
- **DEC-016**: Serialização Decimal → string
- **Schema**: `prisma/schema.prisma` (Transaction, Asset, Account, TransactionType enum)
- **Testes de componente**: `__tests__/components/*.test.tsx` com `// @vitest-environment jsdom`

---

## 🚀 Próximas Etapas

### Para Implementer:
1. Leia documentação completa: `.github/agents/planner-prompt-14-decomposition.md`
2. Execute **Subtarefa 1** (Análise de UI)
3. Reporte bloqueadores a Planner, se houver
4. Siga ordem de implementação: 1 → 2 → 3 → 4 → 5 → 6

### Para Revisor (após Implementer):
- Verificar cobertura de testes (deve passar 135+ testes no total)
- Validar serialização com `console.log` no Client Component
- Confirmar filtros combinados funcionam
- Revisar Tailwind responsividade em mobile

---

## 📝 Exemplo de Uso Final

```tsx
// Usuário acessa /transactions
// Vê tabela com 500 transações

// Seleciona:
// - De: 01/04/2026
// - Até: 15/04/2026
// - Ativo: PETR4
// - Tipo: BUY

// Resultado: 5 de 500 movimentação(ões)
// Tabela renderiza apenas BUYs de PETR4 entre as datas

// Clica "Limpar"
// Volta para 500 de 500
```

---

## 🗂️ Documentação Completa

- **Arquivo principal:** [.github/agents/planner-prompt-14-decomposition.md](./.github/agents/planner-prompt-14-decomposition.md)
- **Subtarefas detalhadas:** 6 seções com specs e critério de aceitação
- **Apêndices:** Tipos, referências, exemplos práticos

---

**Planner:** Decomposição estruturada e pronta para implementação ✅
