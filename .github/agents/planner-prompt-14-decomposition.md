# Prompt 14 — Decomposição: Filtros de Transações Client-Side

**Demanda:** Adicionar filtros por período, ativo e tipo na página `/transactions` com lógica 100% client-side (sem refetch ao backend).

**Contexto:**
- Fase 3, 124 testes passando, build limpo, DEC-017 resolvido
- Padrão client-side já implementado em `/performance` (período 1M/3M/6M/1Y/ALL)
- Stack: Next.js 16 + React 19 + Tailwind v4
- Serialização: Decimal → string (DEC-016)

---

## I. Análise Arquitetural

### Estado Atual
```
src/app/(app)/transactions/page.tsx  [Server Component]
  ├── query banco: últimas 50 transações
  ├── include: asset { ticker, name }, account { name }
  ├── renderiza tabela estática
  └── sem filtros, sem paginação
```

### Arquitetura Desejada
```
src/app/(app)/transactions/page.tsx  [Server Component]
  ├── query banco: últimas 50 transações (aumentar para 200?)
  ├── serializa para client (Decimal → string)
  └── passa props para <TransactionsPageClient>

src/app/(app)/transactions/page-client.tsx  [Client Component - AÚ CRIAR]
  ├── useState: dateRange, assetId, transactionType
  ├── useMemo: filteredTransactions (lógica em memória)
  ├── <TransactionFilters /> (componente de UI)
  └── renderiza tabela filtrada

src/components/TransactionFilters.tsx  [Cliente Component - A CRIAR]
  ├── Props: assets[], onFilter({ startDate, endDate, assetId, type })
  ├── <DateRangePicker>
  ├── <AssetSelect>
  ├── <TypeSelect>
  └── <ResetButton>
```

### Dados passados Server→Client
```typescript
// serialização
transactions.map(tx => ({
  ...tx,
  quantity: tx.quantity?.toString() ?? null,
  price: tx.price?.toString() ?? null,
  totalAmount: tx.totalAmount.toString(),
}))

assets.map(a => ({
  id: a.id,
  ticker: a.ticker,
  name: a.name,
  category: a.category,
}))
```

---

## II. Decomposição em Subtarefas

### **SUBTAREFA 1: Análise de UI e Componentes**
**Objetivo:** Validar disponibilidade de components de data picker e selects  
**Responsável:** Implementer (fase de descoberta)  
**Tempo estimado:** 30 min

#### Ações
- [ ] Verificar se há libs de date picker no `package.json` (react-day-picker, date-fns, etc.)
- [ ] Verificar componentes existentes de `<select>` ou `<input>` em Tailwind
- [ ] Decidir entre:
  - A) Implementar manualmente com `<input type="date">` (simples)
  - B) Usar react-day-picker se disponível
  - C) Usar apenas `<input>` com `range` visual simples

#### Critério de Aceitação
- [ ] Documento no PR descrevendo abordagem escolhida
- [ ] Se precisar instalar package, adicionar ao `package.json` e rodar `pnpm install`
- [ ] Componentes escolhidos funcionam com Tailwind v4

---

### **SUBTAREFA 2: Criar `TransactionFilters` (Componente Reutilizável)**
**Objetivo:** Componente de UI isolado com 3 filtros (período, ativo, tipo)  
**Arquivos:** `src/components/TransactionFilters.tsx`  
**Tipo:** Client Component (`"use client"`)  
**Tempo estimado:** 1 hora

#### Especificação
```typescript
// Props
type TransactionFiltersProps = {
  assets: Array<{ id: string; ticker: string; name: string; category: string }>
  onFilterChange: (filters: {
    startDate: Date | null
    endDate: Date | null
    assetId: string | null
    transactionType: string | null
  }) => void
  disabled?: boolean
}

// Componente renderiza:
- <div className="bg-white rounded-xl border border-gray-200 p-4">
  - `<DateRangeInputs startDate, endDate, onChange>`
  - `<AssetSelect assets, onSelect>`
  - `<TypeSelect onSelect>`
  - `<ResetButton onClick={onReset}>`
```

#### Implementação
- [ ] DateRange: dois inputs type="date" lado a lado
  - `startDate?.toISOString().split('T')[0]` ↔ `endDate`
  - onChange dispara `onFilterChange` com novo range
- [ ] AssetSelect: `<select>` com opções de assets
  - default: "Todos os ativos"
  - agrupa por categoria opcionalmenteinclui ticker + name no label
  - onChange dispara `onFilterChange`
- [ ] TypeSelect: `<select>` com tipos de transação
  - opções: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INCOME, RENT
  - labels em pt-BR (já definidos em `page.tsx`)
  - default: "Todos os tipos"
  - onChange dispara `onFilterChange`
- [ ] ResetButton: limpa todos os filtros de uma vez
  - state local: `{ startDate: null, endDate: null, assetId: null, type: null }`

#### UI/UX
- [ ] Layout: flex row com gap-4, responsivo (md: grid 2 cols)
- [ ] Styling Tailwind v4: bg-white, border-gray-200, rounded-xl, p-4
- [ ] Placeholder text legível: "De" / "Até", "Selecionar ativo", "Selecionar tipo"
- [ ] Reset button com cor secundária (botão cinza)

#### Critério de Aceitação
- [ ] Arquivo criado e sem erros TypeScript
- [ ] Componente renderiza sem erros no Storybook ou visualmente
- [ ] Props corretamente tipadas
- [ ] onChange callbacks disparam corretamente

---

### **SUBTAREFA 3: Refatorar `/transactions/page.tsx` para Server + Client split**
**Objetivo:** Mover lógica de apresentação para Client Component  
**Arquivos:**  
- `src/app/(app)/transactions/page.tsx` [modificar]
- `src/app/(app)/transactions/page-client.tsx` [criar]  
**Tempo estimado:** 45 min

#### Passo 3.1: Aumentar limite de transações no backend
**Arquivo:** `src/app/(app)/transactions/page.tsx`  
```typescript
// Atual: take: 50
// Novo: take: 500 (ou 200 se performance for issue)

const transactions = await prisma.transaction.findMany({
  where: { accountId: { in: accountIds } },
  include: {
    asset: { select: { id: true, ticker: true, name: true } }, // ADD id
    account: { select: { name: true } },
  },
  orderBy: { date: 'desc' },
  take: 500, // ← AUMENTAR
})

// Serializar Decimal para string
const serializedTransactions = transactions.map(tx => ({
  ...tx,
  quantity: tx.quantity?.toString() ?? null,
  price: tx.price?.toString() ?? null,
  totalAmount: tx.totalAmount.toString(),
}))

// Extrair lista única de ativos
const uniqueAssets = Array.from(
  new Map(
    transactions
      .filter(tx => tx.asset)
      .map(tx => [tx.asset!.id, tx.asset!])
  ).values()
)
```

**Critério:**
- [ ] Query retorna até 500 transações
- [ ] Decimal convertido para string (JSON-serializable)
- [ ] Sem error de serialização no boundary Server→Client
- [ ] Assets únicos extraídos corretamente

#### Passo 3.2: Criar `page-client.tsx` com filtragem
**Arquivo:** `src/app/(app)/transactions/page-client.tsx` [NOVO]  
```typescript
'use client'

import { useMemo, useState } from 'react'
import TransactionFilters from '@/components/TransactionFilters'

type TransactionRecord = {
  id: string
  type: string
  date: string // ISO string
  quantity: string | null
  price: string | null
  totalAmount: string
  assetId: string | null
  asset?: { id: string; ticker: string; name: string }
  account: { name: string }
}

type Asset = {
  id: string
  ticker: string
  name: string
  category: string
}

type Props = {
  initialTransactions: TransactionRecord[]
  assets: Asset[]
}

type Filters = {
  startDate: Date | null
  endDate: Date | null
  assetId: string | null
  transactionType: string | null
}

export default function TransactionsPageClient({ initialTransactions, assets }: Props) {
  const [filters, setFilters] = useState<Filters>({
    startDate: null,
    endDate: null,
    assetId: null,
    transactionType: null,
  })

  const filteredTransactions = useMemo(() => {
    return initialTransactions.filter(tx => {
      // Filter by date range
      if (filters.startDate) {
        const txDate = new Date(tx.date)
        if (txDate < filters.startDate) return false
      }
      if (filters.endDate) {
        const txDate = new Date(tx.date)
        const endOfDay = new Date(filters.endDate)
        endOfDay.setHours(23, 59, 59, 999)
        if (txDate > endOfDay) return false
      }

      // Filter by asset
      if (filters.assetId && tx.assetId !== filters.assetId) return false

      // Filter by transaction type
      if (filters.transactionType && tx.type !== filters.transactionType) return false

      return true
    })
  }, [initialTransactions, filters])

  return (
    <div className="space-y-6">
      <TransactionFilters
        assets={assets}
        onFilterChange={setFilters}
      />

      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Nenhuma movimentação encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ativo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Conta</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preço</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(tx.type)}`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tx.asset?.ticker ?? '—'}
                      {tx.asset?.name && (
                        <span className="block text-xs text-gray-400 font-normal">{tx.asset.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tx.account.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {tx.quantity ? parseFloat(tx.quantity).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {tx.price ? formatCurrency(tx.price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
            {filteredTransactions.length} de {initialTransactions.length} movimentação(ões)
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

const typeLabels: Record<string, string> = {
  BUY: 'Compra',
  SELL: 'Venda',
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Retirada',
  DIVIDEND: 'Dividendo',
  INCOME: 'Rendimento',
  RENT: 'Aluguel',
}

const typeColors: Record<string, string> = {
  BUY: 'bg-blue-50 text-blue-700',
  SELL: 'bg-purple-50 text-purple-700',
  DEPOSIT: 'bg-green-50 text-green-700',
  WITHDRAWAL: 'bg-red-50 text-red-700',
  DIVIDEND: 'bg-yellow-50 text-yellow-700',
  INCOME: 'bg-teal-50 text-teal-700',
  RENT: 'bg-orange-50 text-orange-700',
}

function getTypeLabel(type: string): string {
  return typeLabels[type] ?? type
}

function getTypeColor(type: string): string {
  return typeColors[type] ?? 'bg-gray-100 text-gray-600'
}

function formatCurrency(value: string | null): string {
  if (!value) return '—'
  return parseFloat(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
```

**Critério:**
- [ ] Componente renderiza sem erros
- [ ] `useMemo` filtra corretamente por startDate, endDate, assetId, type
- [ ] Tabela renderiza transações filtradas
- [ ] Contador de transações exibido corretamente
- [ ] Mensagem vazia aparece quando 0 resultados

#### Passo 3.3: Atualizar `page.tsx` para chamar Client Component
**Arquivo:** `src/app/(app)/transactions/page.tsx` [MODIFICAR]  
```typescript
// Remover: função async TransactionsContent()
// Remover: função TransactionsSkeleton()

// Adicionar na função main export:
import TransactionsPageClient from './page-client'

async function TransactionsContent() {
  // ... query + serialização
  return <TransactionsPageClient initialTransactions={serializedTransactions} assets={uniqueAssets} />
}

export default function TransactionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        {/* ... header igual */}
      </div>
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </div>
  )
}
```

**Critério:**
- [ ] `page.tsx` reconhece `page-client.tsx`
- [ ] Props passadas corretamente (sintaxe TypeScript)
- [ ] Sem erro de compilação

---

### **SUBTAREFA 4: Adicionar Testes de Componente**
**Objetivo:** Testar `TransactionFilters` em isolamento  
**Arquivos:** `__tests__/components/TransactionFilters.test.tsx`  
**Tempo estimado:** 1 hora

#### Spec
```typescript
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TransactionFilters from '@/components/TransactionFilters'

const mockAssets = [
  { id: '1', ticker: 'PETR4', name: 'Petrobras', category: 'STOCK' },
  { id: '2', ticker: 'ITUB4', name: 'Itaú', category: 'STOCK' },
  { id: '3', ticker: 'KNOT11', name: 'Klabin Prop', category: 'FII' },
]

describe('TransactionFilters', () => {
  it('renders all filter inputs', () => {
    const mockChange = vi.fn()
    render(<TransactionFilters assets={mockAssets} onFilterChange={mockChange} />)
    
    expect(screen.getByPlaceholderText(/de/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/até/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/todos os ativos/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/todos os tipos/i)).toBeInTheDocument()
  })

  it('calls onFilterChange with start date', () => {
    const mockChange = vi.fn()
    render(<TransactionFilters assets={mockAssets} onFilterChange={mockChange} />)
    
    const startDateInput = screen.getByPlaceholderText(/de/i)
    fireEvent.change(startDateInput, { target: { value: '2026-04-01' } })
    
    expect(mockChange).toHaveBeenCalled()
    expect(mockChange.mock.calls[0][0].startDate).toEqual(new Date('2026-04-01'))
  })

  it('filters asset options correctly', () => {
    const mockChange = vi.fn()
    render(<TransactionFilters assets={mockAssets} onFilterChange={mockChange} />)
    
    const assetSelect = screen.getByDisplayValue(/todos os ativos/i)
    expect(assetSelect).toHaveLength(mockAssets.length + 1) // +1 para default
  })

  it('resets all filters on reset button click', () => {
    const mockChange = vi.fn()
    const { rerender } = render(
      <TransactionFilters assets={mockAssets} onFilterChange={mockChange} />
    )
    
    const resetBtn = screen.getByRole('button', { name: /limpar/i })
    fireEvent.click(resetBtn)
    
    // Outputs should show all filters cleared
    const calls = mockChange.mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall).toEqual({
      startDate: null,
      endDate: null,
      assetId: null,
      transactionType: null,
    })
  })

  it('handles transaction type selection', () => {
    const mockChange = vi.fn()
    render(<TransactionFilters assets={mockAssets} onFilterChange={mockChange} />)
    
    const typeSelect = screen.getByDisplayValue(/todos os tipos/i)
    fireEvent.change(typeSelect, { target: { value: 'BUY' } })
    
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({ transactionType: 'BUY' })
    )
  })
})
```

**Critério:**
- [ ] Todos os 5 testes passam
- [ ] Cobertura: render, inputs, onChange, reset
- [ ] Sem warnings de console

---

### **SUBTAREFA 5: Adicionar Testes de Integração (Página)**
**Objetivo:** Testar filtro end-to-end na página `/transactions`  
**Arquivos:** `__tests__/app/transactions-filters.test.tsx`  
**Tempo estimado:** 1 hora

#### Spec
```typescript
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TransactionsPageClient from '@/app/(app)/transactions/page-client'

const mockTransactions = [
  {
    id: '1',
    type: 'BUY',
    date: '2026-04-01T10:00:00Z',
    quantity: '100',
    price: '50.00',
    totalAmount: '5000.00',
    assetId: '1',
    asset: { id: '1', ticker: 'PETR4', name: 'Petrobras' },
    account: { name: 'Conta Corrente' },
  },
  {
    id: '2',
    type: 'DIVIDEND',
    date: '2026-04-05T10:00:00Z',
    quantity: null,
    price: null,
    totalAmount: '150.00',
    assetId: '1',
    asset: { id: '1', ticker: 'PETR4', name: 'Petrobras' },
    account: { name: 'Conta Corrente' },
  },
  {
    id: '3',
    type: 'BUY',
    date: '2026-03-15T10:00:00Z',
    quantity: '50',
    price: '100.00',
    totalAmount: '5000.00',
    assetId: '2',
    asset: { id: '2', ticker: 'ITUB4', name: 'Itaú' },
    account: { name: 'Conta Poupança' },
  },
]

const mockAssets = [
  { id: '1', ticker: 'PETR4', name: 'Petrobras', category: 'STOCK' },
  { id: '2', ticker: 'ITUB4', name: 'Itaú', category: 'STOCK' },
]

describe('TransactionsPageClient - Filtering', () => {
  it('renders all transactions initially', () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    expect(screen.getByText(/3 de 3/)).toBeInTheDocument()
  })

  it('filters by date range', async () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    const startDateInput = screen.getByPlaceholderText(/de/i)
    fireEvent.change(startDateInput, { target: { value: '2026-04-01' } })
    
    await waitFor(() => {
      expect(screen.getByText(/2 de 3/)).toBeInTheDocument()
    })
  })

  it('filters by asset', async () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    const assetSelect = screen.getByDisplayValue(/todos os ativos/i)
    fireEvent.change(assetSelect, { target: { value: 'PETR4' } })
    
    await waitFor(() => {
      expect(screen.getByText(/2 de 3/)).toBeInTheDocument()
    })
  })

  it('filters by transaction type', async () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    const typeSelect = screen.getByDisplayValue(/todos os tipos/i)
    fireEvent.change(typeSelect, { target: { value: 'BUY' } })
    
    await waitFor(() => {
      expect(screen.getByText(/2 de 3/)).toBeInTheDocument()
    })
  })

  it('combines multiple filters', async () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    // Filter by asset = PETR4
    const assetSelect = screen.getByDisplayValue(/todos os ativos/i)
    fireEvent.change(assetSelect, { target: { value: '1' } })
    
    // Filter by type = BUY
    const typeSelect = screen.getByDisplayValue(/todos os tipos/i)
    fireEvent.change(typeSelect, { target: { value: 'BUY' } })
    
    await waitFor(() => {
      expect(screen.getByText(/1 de 3/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no matches', async () => {
    render(
      <TransactionsPageClient initialTransactions={mockTransactions} assets={mockAssets} />
    )
    
    const assetSelect = screen.getByDisplayValue(/todos os ativos/i)
    fireEvent.change(assetSelect, { target: { value: 'nonexistent' } })
    
    await waitFor(() => {
      expect(screen.getByText(/nenhuma movimentação encontrada com os filtros/i)).toBeInTheDocument()
    })
  })
})
```

**Critério:**
- [ ] Todos os 6 testes passam
- [ ] Transações filtradas corretamente por data, asset, tipo
- [ ] Combinação de filtros funciona
- [ ] Empty state renderiza
- [ ] Contador de transações atualiza

---

### **SUBTAREFA 6: Atualizar Documentação**
**Objetivo:** Registrar mudanças em docs/ e memory/  
**Arquivos:**  
- `docs/modules/transactions.md` [ATUALIZAR]
- `memory/current-state.md` [ATUALIZAR]  
- `.github/CHANGELOG.md` [CRIAR entrada]  
**Tempo estimado:** 30 min

#### Update `docs/modules/transactions.md`
Adicionar seção "Filtros Client-Side (V2)":
```markdown
## Filtros Client-Side (V2)

### Overview
A partir da v2, a página `/transactions` suporta filtros 100% client-side sem refetch ao backend.

### Componente `TransactionFilters`
- Localização: `src/components/TransactionFilters.tsx`
- Props: `assets`, `onFilterChange`
- Funcionalidades:
  - DateRange picker (de/até)
  - Asset select (dropdown)
  - TransactionType select (dropdown)
  - Reset button

### Fluxo de dados
1. Server carrega até 500 transações
2. Serializa Decimal → string
3. Passa para `TransactionsPageClient`
4. Client aplica filtros com `useMemo`
5. Tabela atualiza sem refetch

### Performance
- Filtração em memória: O(n) linear
- useMemo evita recalcular a cada render
- Recomendado: até 500 transações (testar limite)

### Exemplos de uso
```tsx
<TransactionFilters
  assets={assets}
  onFilterChange={(filters) => setFilters(filters)}
/>
```
```

#### Update `memory/current-state.md`
```markdown
### Transactions/Ledger — v2 com filtros client-side
Status: implementado com filtros (período, ativo, tipo).
Arquivos-chave: src/app/(app)/transactions/page.tsx, page-client.tsx, src/components/TransactionFilters.tsx
Contratos: createTransaction, getAccountBalance, getTransactionsByAccount, filterTransactions (in-memory)
Testes: 12 + 5 de componente = 17 total
```

#### Commit Message (exemplo)
```
feat(transactions): adicionar filtros client-side com DateRange, Asset, Type

- Criar component TransactionFilters reutilizável
- Refatorar /transactions em Server + Client split
- Aumentar limite de transações de 50 → 500
- Serializar Decimal → string no boundary Server→Client
- Adicionar 5 testes de componente + 6 testes de integração
- Atualizar docs/modules/transactions.md

Padrão: useMemo para filtragem em memória (sem refetch)
Fechas padrão vazias por default, usuário define opcionalmente
Contador exibe resultado: "X de Y movimentação(ões)"
```

**Critério:**
- [ ] Documentação atualizada e clara
- [ ] Commit message bem estruturado
- [ ] Memory updated com estado v2
- [ ] Sem broken links em docs

---

## III. Ordem de Implementação (RECOMENDADO)

```
1. SUBTAREFA 1 (Análise)             → 30 min
   Validar UI e decidir abordagem

2. SUBTAREFA 2 (Component)           → 1h
   Criar TransactionFilters.tsx com 3 inputs

3. SUBTAREFA 3 (Refactor page)       → 45 min
   Criar page-client.tsx com filtro + atualizar page.tsx

4. SUBTAREFA 4 (Testes=component)    → 1h
   5 testes de TransactionFilters

5. SUBTAREFA 5 (Testes integração)   → 1h
   6 testes de TransactionsPageClient filtering

6. SUBTAREFA 6 (Documentação)        → 30 min
   Atualizar docs e commit

TOTAL: ~5h 15min
```

---

## IV. Critérios de Aceitação Globais (DoD)

- [ ] **124 testes ainda passando** (não regressão)
- [ ] **Nenhuma quebra de build** (TypeScript limpo)
- [ ] **Filtros funcionam** (dateRange, assetId, transactionType isolados + combinados)
- [ ] **Performance** (useMemo otimiza recálculos)
- [ ] **UI responsiva** (Tailwind v4, mobile-friendly)
- [ ] **Serialização correcta** (Decimal → string no boundary)
- [ ] **Testes com boa cobertura** (render, onChange, reset, filtering combinations)
- [ ] **Documentação atualizada** (docs/ + memory/)
- [ ] **Commit estruturado** em pt-BR com escopo (transactions)

---

## V. Handoff para Implementer

**Próximo passo:** Implementer lê este documento e executa SUBTAREFA 1 (Análise).  
**Contact:** Se dúvida na especificação, solicitar clarificação ao Planner antes de contar.  
**Monitoramento:** Planner acompanha progresso e reajusta scope se necessário.

---

## Apêndice A: Referência de Tipos

```typescript
// TransactionType enum (do schema)
enum TransactionType {
  BUY = 'BUY'
  SELL = 'SELL'
  DEPOSIT = 'DEPOSIT'
  WITHDRAWAL = 'WITHDRAWAL'
  DIVIDEND = 'DIVIDEND'
  INCOME = 'INCOME'
  RENT = 'RENT'
}

// AssetCategory enum (para categorizar ativos)
enum AssetCategory {
  STOCK = 'STOCK'
  FII = 'FII'
  ETF = 'ETF'
  FIXED_INCOME = 'FIXED_INCOME'
  FUND = 'FUND'
  CRYPTO = 'CRYPTO'
  METAL = 'METAL'
  REAL_ESTATE = 'REAL_ESTATE'
}

// Serialized Transaction (Server → Client)
{
  id: string
  type: TransactionType
  date: string // ISO 8601
  quantity: string | null // Decimal serializado
  price: string | null // Decimal serializado
  totalAmount: string // Decimal serializado
  assetId: string | null
  asset?: { id: string; ticker: string; name: string }
  account: { name: string }
}
```

---

## Apêndice B: Links Úteis

- [Decisão DEC-016: Serialização Decimal](./decisions.md#dec-016)
- [Referência de ui/select Tailwind v4](https://tailwindcss.com/docs/forms)
- [React useMemo](https://react.dev/reference/react/useMemo)
- [Padrão de Client Component no Next.js 16](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- Exemplo: `/src/app/(app)/performance/performance-page-client.tsx`
