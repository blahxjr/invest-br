# ADR-001 — Modelo de Ledger: Partidas Simples com balanceAfter

**Status:** Aceito  
**Data:** 2026-04-07  
**Módulo:** transactions / ledger_entries

## Contexto

O sistema precisa registrar movimentações financeiras de forma auditável. Existem dois modelos clássicos:
1. **Partidas duplas** (double-entry): cada transação gera dois lançamentos — débito em uma conta e crédito em outra.
2. **Partidas simples com saldo acumulado**: cada transação gera um lançamento por conta afetada, com saldo calculado na escrita.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Partidas duplas | Padrão contábil, reconciliação automática | Complexidade na V1, requer contas contábeis auxiliares |
| Partidas simples + balanceAfter | Simples, auditável, saldo rastreável por entrada | Não reconcilia automaticamente entre contas |

## Decisão

Usar **partidas simples com `balanceAfter`**. Cada `LedgerEntry` registra débito OU crédito (não ambos) e o saldo da conta após essa entrada.

## Consequências

- `debit` e `credit` são mutuamente exclusivos em cada entrada (um será `null`).
- `balanceAfter` deve ser lido do último registro antes de calcular o novo saldo.
- Sem deleção de entradas — append-only é regra de negócio.
- Evolução para partidas duplas é possível na V2 adicionando tabela de contas contábeis.

## Trade-offs

- Ganho: implementação e testes simples na fase atual.
- Perda: não detecta discrepâncias entre contas automaticamente.
- Mitigação: testes verificam `balanceAfter` esperado após cada operação.
