# Audit Agent Contabil

## Objetivo

Garantir consistencia contabil antes da ingestao no ledger, bloqueando dados invalidos e emitindo relatorio auditavel para revisao.

## Escopo atual

O agent roda no script scripts/analyze-coverage.ts e aplica, para cada amostra:

1. classifyMovement
2. resolveAssetClass
3. validateTransactionConsistency

Em caso de erro contabil, o processo encerra com codigo 1 (fail fast).

## Regras contabeis

1. Entrada/Saida vs isIncoming
- Entrada/Credito: isIncoming deve ser true.
- Saida/Debito: isIncoming deve ser false.

2. BUY
- BUY deve ser isIncoming false.

3. SELL
- SELL deve ser isIncoming true.

4. INCOME/DIVIDEND
- INCOME e DIVIDEND devem ser isIncoming true.

5. MATURITY
- MATURITY deve ser isIncoming true.

6. CUSTODY_TRANSFER
- Nao representa caixa real.
- Se houver valor monetario relevante, gera warning.

7. SUBSCRIPTION_RIGHT
- Nao deve ter valor financeiro.
- Se houver valor, gera erro.

8. Consistencia de ativo
- AssetClass deve existir.
- Se ausente, gera erro critico e bloqueia ingestao.

## Interpretacao de saida

Secoes principais do script:

- === Relatorio de Cobertura de Movimentacao B3 ===
- === Audit Errors ===
- === Audit Warnings ===

Cada linha informa:
- movimentacao
- tipo classificado
- entrada/saida original
- produto/ticker
- motivo (errors ou warnings)
- arquivo de origem

## Evolucao recomendada

1. Adicionar severidade por regra (alta, media, baixa).
2. Persistir relatorio estruturado em JSON para CI.
3. Acoplar checks de reconciliacao com saldos (pre-ledger).
4. Encadear com o Ledger Engine para validacao double-entry.
