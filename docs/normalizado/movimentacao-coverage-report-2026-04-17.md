# Relatorio de Cobertura - Movimentacao B3 (2026-04-17)

## Contexto

- Fonte: docs/normalizado/movimentacao-2026-04-16-18-57-24.normalizado.csv
- Script: scripts/analyze-coverage.ts
- Objetivo: avaliar cobertura real de classifyMovement() por tipo unico de "Movimentacao".

## Resultado

- Total de movimentacoes unicas analisadas: 21
- Mapeados: 20
- ReviewRequired: 1
- Unknown: 0

## ReviewRequired

- Compra
  - reason: compra_sem_contexto_renda_fixa
  - entradaSaida: Credito
  - produto: Tesouro Prefixado com Juros Semestrais 2031
  - source: docs/normalizado/movimentacao-2026-04-16-18-57-24.normalizado.csv

## Observacoes

- Nao ha tipos desconhecidos silenciosos.
- O gap remanescente exige regra explicita para "Compra" em contexto de Tesouro Direto (fora do escopo de renda fixa CDB/LCI/LCA/CRI/CRA/Debenture tratado nesta sessao).
