# Módulo: Import B3

**Última atualização:** 2026-04-13

## Visão Geral

Permite ao usuário importar os três tipos de planilha exportados pela B3 (CEI / Canal Eletrônico do Investidor):

| Planilha | Arquivo | Ação no sistema |
|---|---|---|
| Negociação | `negociacao-*.xlsx` | Cria transações `BUY` / `SELL` |
| Movimentação | `movimentacao-*.xlsx` | Cria transações `BUY` / `DIVIDEND` (filtrando eventos irrelevantes) |
| Posição | `posicao-*.xlsx` | Faz upsert de ativos no catálogo (`Asset`) — não cria transações |

---

## Estrutura de Arquivos

```
src/
  modules/
    b3/
      parser/
        index.ts          ← tipos compartilhados (NegociacaoRow, MovimentacaoRow, PosicaoRow)
        negociacao.ts     ← parseNegociacaoRow(row): NegociacaoRow
        movimentacao.ts   ← parseMovimentacaoRow(row): MovimentacaoRow | null
        posicao.ts        ← parsePosicaoRow(row, sheet): PosicaoRow
      service.ts          ← lógica de domínio (upsert ativo + createTransaction)
      __tests__/
        negociacao.test.ts
        movimentacao.test.ts
        posicao.test.ts
  app/
    (app)/
      import/
        page.tsx                ← Server Component (título + metadados)
        import-page-client.tsx  ← Client Component com 3 ImportCards
        actions.ts              ← Server Actions: importNegociacao, importMovimentacao, importPosicao
```

---

## Parsers

### negociacao.ts

Parser da sheet **Negociação** (`negociacao-*.xlsx`).

**Colunas (ordem fixa):**
```
[0] Data do Negócio
[1] Tipo de Movimentação   → BUY | SELL
[2] Mercado                → detecta fracionário
[3] Prazo/Vencimento       → ignorado
[4] Instituição
[5] Código de Negociação   → ticker (remove sufixo F se fracionário)
[6] Quantidade
[7] Preço
[8] Valor
```

**Regras:**
- `"Compra"` → `BUY`, `"Venda"` → `SELL`
- Mercado `"Mercado Fracionário"` → remover sufixo `F` do ticker (ex: `AGRO3F` → `AGRO3`)
- `referenceId` = `negociacao-{YYYY-MM-DD}-{ticker}-{quantidade}-{preco}`

---

### movimentacao.ts

Parser da sheet **Movimentação** (`movimentacao-*.xlsx`).

**Colunas (ordem fixa):**
```
[0] Entrada/Saída
[1] Data
[2] Movimentação           → mapeado para TransactionType ou null
[3] Produto                → "TICKER - NOME COMPLETO" → extrair ticker
[4] Instituição
[5] Quantidade
[6] Preço unitário         → pode ser "-"
[7] Valor da Operação      → pode ser "-"
```

**Mapeamento de tipos:**

| Movimentação B3 | TransactionType | Processar |
|---|---|---|
| `Transferência - Liquidação` | `BUY` | ✅ |
| `Rendimento` | `DIVIDEND` | ✅ |
| `Juros Sobre Capital Próprio` | `DIVIDEND` | ✅ |
| `Dividendo` | `DIVIDEND` | ✅ |
| `Cessão de Direitos` | — | ❌ |
| `Cessão de Direitos - Solicitada` | — | ❌ |
| `Direito de Subscrição` | — | ❌ |
| `Direitos de Subscrição` | — | ❌ |
| `Direitos de Subscrição - Não Exercido` | — | ❌ |
| `Atualização` | — | ❌ |

Retorna `null` para tipos ignorados.

---

### posicao.ts

Parser da planilha **Posição** (`posicao-*.xlsx`) — 4 sheets.

**Sheets e mapeamento de categoria:**

| Sheet | Tipo (coluna) | AssetCategory |
|---|---|---|
| `Acoes` | ON / PN / UNIT | `STOCK` |
| `BDR` | BDR | `BDR` *(ver ADR-004)* |
| `ETF` | Ações / RF / Internacional / FII | `ETF` |
| `Fundo de Investimento` | Cotas / Fundo | `FII` |

**Saída por linha:**
- `ticker` — de `Código de Negociação`
- `name` — extraído de `Produto` (split ` - `, parte[1..].join)
- `category` — conforme tabela acima
- `quantity`, `closePrice`, `updatedValue`
- `instituicao`, `conta`

Linhas sem `Código de Negociação` (totais) são ignoradas automaticamente.

---

## Service

`src/modules/b3/service.ts` contém a lógica de domínio desacoplada das Server Actions:

```typescript
export async function persistNegociacao(rows: NegociacaoRow[], accountId: string): Promise<ImportResult>
export async function persistMovimentacao(rows: MovimentacaoRow[], accountId: string): Promise<ImportResult>
export async function syncPosicao(rows: PosicaoRow[]): Promise<SyncResult>
```

- `persistNegociacao` / `persistMovimentacao`: para cada row, busca ou cria o `Asset` via `getAssetByTicker` + upsert, depois chama `createTransaction` com `referenceId` para garantir idempotência
- `syncPosicao`: faz upsert de `Asset` com nome completo, category e assetClassId inferido
- `BDR` ja e categoria nativa do enum `AssetCategory` no schema atual

---

## Server Actions

`src/app/(app)/import/actions.ts`

| Action | Input | Output |
|---|---|---|
| `importNegociacao(formData)` | arquivo `.xlsx` | `{ imported, skipped, errors }` |
| `importMovimentacao(formData)` | arquivo `.xlsx` | `{ imported, skipped, errors }` |
| `importPosicao(formData)` | arquivo `.xlsx` | `{ upserted, errors }` |

Fluxo interno:
1. Ler arquivo com `xlsx` (SheetJS)
2. Extrair rows da(s) sheet(s)
3. Chamar parser correspondente
4. Chamar service para persistência
5. Retornar resultado para o Client Component exibir no toast

---

## Página de Upload

Rota: `/import`

Composta por:
- `page.tsx` — Server Component (título, metadados)
- `import-page-client.tsx` — Client Component com 3 `<ImportCard>` reutilizáveis

Cada `ImportCard` expõe:
- Label do tipo de planilha
- Input de arquivo (`.xlsx`)
- Botão "Importar"
- Toast com resultado (`X importadas, Y ignoradas`)

---

## Navegação

Item **"Importar B3"** adicionado na `Sidebar.tsx` entre **Movimentações** e **Proventos**.
`Sidebar.test.tsx` atualizado na mesma entrega.

---

## Dependência

```json
"xlsx": "^0.18.5"
```

SheetJS — leve, sem dependência de stream, funciona em Server Actions Next.js.

---

## Testes

| Arquivo | Cobertura |
|---|---|
| `negociacao.test.ts` | parse de compra, remoção de sufixo F, geração de referenceId |
| `movimentacao.test.ts` | classificação de Rendimento/DIVIDEND, ignorar Cessão de Direitos, ignorar Atualização |
| `posicao.test.ts` | parse de ação (STOCK), parse de FII (Cotas), parse de BDR com fallback |

**Resultado do modulo:** 10 testes especificos de parser/importacao — 0 falhas.

---

## Observações de Domínio

- A planilha de **Posição** é destinada exclusivamente à sincronização do catálogo de ativos. Não gera transações.
- O campo `referenceId` garante idempotência total: reimportar o mesmo arquivo não duplica transações.
- Tickers fracionários (`F` sufixo) são normalizados **antes** de qualquer busca ou criação de ativo.
- O `accountId` default é obtido via `getDefaultAccountForUser(userId)` no service.
