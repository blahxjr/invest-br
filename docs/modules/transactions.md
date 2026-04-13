# Módulo: Transactions + Ledger

## Objetivo

Registrar toda movimentação financeira do usuário de forma auditável, idempotente e atômica. É o núcleo do sistema: sem transactions, não há histórico, posição, proventos nem base para qualquer cálculo.

## Entidades

### Transaction
| Campo        | Tipo             | Descrição                                                  |
|--------------|------------------|------------------------------------------------------------|
| id           | String (cuid)    | Identificador interno                                      |
| referenceId  | String (unique)  | **Chave de idempotência** — definida pelo caller           |
| type         | TransactionType  | Tipo da operação (enum)                                    |
| accountId    | String           | FK para Account                                            |
| assetId      | String?          | FK opcional para Asset (obrigatório em BUY/SELL)           |
| quantity     | Decimal(18,8)?   | Quantidade de ativos negociados                            |
| price        | Decimal(18,8)?   | Preço unitário                                             |
| totalAmount  | Decimal(18,2)    | Valor financeiro total (obrigatório em todos os tipos)     |
| date         | DateTime         | Data da operação (não `createdAt`)                         |
| notes        | String?          | Observações livres                                         |
| createdAt    | DateTime         | Timestamp de inserção no banco                             |

### LedgerEntry
| Campo        | Tipo           | Descrição                                      |
|--------------|----------------|------------------------------------------------|
| id           | String (cuid)  | Identificador interno                          |
| transactionId| String         | FK para Transaction                            |
| accountId    | String         | FK para Account                                |
| debit        | Decimal(18,2)? | Saída de valor (BUY, WITHDRAWAL)               |
| credit       | Decimal(18,2)? | Entrada de valor (SELL, DEPOSIT, DIVIDEND…)    |
| balanceAfter | Decimal(18,2)  | Saldo da conta após esta entrada (auditável)   |
| createdAt    | DateTime       | Timestamp de inserção                          |

## Enum: TransactionType

| Valor      | Descrição                         | Efeito no Ledger |
|------------|-----------------------------------|------------------|
| BUY        | Compra de ativo                   | Débito           |
| SELL       | Venda de ativo                    | Crédito          |
| DEPOSIT    | Aporte em conta                   | Crédito          |
| WITHDRAWAL | Saque / retirada                  | Débito           |
| DIVIDEND   | Dividendo recebido                | Crédito          |
| INCOME     | Rendimento (JCP, CDB…)            | Crédito          |
| RENT       | Aluguel de imóvel ou ativo        | Crédito          |

## Invariantes críticas

1. **Atomicidade:** Transaction + LedgerEntry sempre criados juntos via `prisma.$transaction()`.
2. **Idempotência:** `referenceId` é `@unique` — segunda chamada com mesmo ID retorna a transação existente sem reprocessar.
3. **Append-only:** LedgerEntries nunca são atualizados nem deletados. Correções são feitas com novas transações de estorno.
4. **balanceAfter obrigatório:** Calculado no momento da escrita com base no último `balanceAfter` da conta.
5. **totalAmount obrigatório:** Presente em todos os tipos, inclusive dividendos sem ativo específico.

## Serviços

| Função                            | Descrição                                                   |
|-----------------------------------|-------------------------------------------------------------|
| `createTransaction(input)`        | Cria transação + ledger atomicamente, com idempotência      |
| `getTransactionsByAccount(id)`    | Lista transações de uma conta (desc por data)               |
| `getAccountBalance(id)`           | Retorna saldo atual (último balanceAfter)                   |
| `getTransactionByReference(ref)`  | Busca por referenceId (debug/auditoria)                     |

## Fluxo de idempotência

```
caller → createTransaction({ referenceId: 'compra-petr4-001', ... })
          ↓
     findUnique(referenceId) → existente?
          ↓ sim                      ↓ não
     return { ..., idempotent: true }  prisma.$transaction([create TX, create LE])
```

## Exemplo de uso

```typescript
// Depósito inicial
await createTransaction({
  referenceId: 'deposito-jan-2026',
  type: 'DEPOSIT',
  accountId: '...',
  totalAmount: 10000,
  date: new Date('2026-01-10'),
})

// Compra PETR4
await createTransaction({
  referenceId: 'compra-petr4-001',
  type: 'BUY',
  accountId: '...',
  assetId: 'petr4-id',
  quantity: 100,
  price: 35.50,
  totalAmount: 3550,
  date: new Date('2026-01-15'),
})
```

## Migration

`20260408004030_transactions_ledger` — Cria tabelas `Transaction`, `LedgerEntry`, enum `TransactionType`. Adiciona relações reversas em `Account` e `Asset`.

## Decisão de Design

Ver ADR-001 em `docs/decisions/ADR-001-ledger-model.md`.

## Dependências

- Account (FK obrigatória)
- Asset (FK opcional — obrigatória em BUY/SELL)

## Próximos passos

- Calcular posição por ativo (Épico 2.1) derivando de Transactions
- Criar `IncomeEvent` e `RentalReceipt` (Épico 2.2)
- Criar estorno como nova Transaction do tipo oposto
