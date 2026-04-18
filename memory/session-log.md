# Session Log - 2026-04-17

## Escopo executado

- Criado script temporario scripts/analyze-coverage.ts para cobertura de classifyMovement() com tipos unicos de movimentacao.
- Atualizado classifyMovement() em src/modules/b3/parser/movimentacao.ts para:
  - mapear COMPRA / VENDA em renda fixa para BUY (saida) e MATURITY (entrada)
  - manter VENCIMENTO/RESGATE como MATURITY com semantica de entrada de caixa
  - tratar isTaxExempt por ativo de renda fixa (LCA/LCI/CRI/CRA=true; CDB/Debenture=false)
  - cobrir Atualizacao (com e sem acento via normalizacao), Bonificacao em Ativos, Desdobro, Fracao em Ativos, Leilao de Fracao
  - cobrir variantes reais do lote: APLICACAO, Juros, Transferencia, Resgate Antecipado
- Atualizados testes em __tests__/modules/b3/movimentacao.test.ts para novos cenarios de renda fixa e eventos corporativos.

## Relatorio de cobertura

- Fonte: docs/normalizado/movimentacao-2026-04-16-18-57-24.normalizado.csv
- Total de tipos unicos: 21
- Mapeados: 20
- ReviewRequired: 1
- Unknown: 0

### Gap restante

- Compra
  - reason: compra_sem_contexto_renda_fixa
  - contexto: produto "Tesouro Prefixado com Juros Semestrais 2031" com entradaSaida "Credito"
  - observacao: requer regra de dominio para Tesouro Direto (direcao/semantica contabil especifica)

## Execucao de testes

- Comando solicitado: pnpm test -- --reporter=verbose src/modules/b3
  - resultado: falha fora do escopo B3 em __tests__/components/ImportPageClient.test.tsx
- Validacao de movimentacao apos refatoracao:
  - pnpm test -- --reporter=verbose __tests__/modules/b3/movimentacao.test.ts
  - resultado: passou

## Artefatos gerados

- scripts/analyze-coverage.ts
- docs/normalizado/movimentacao-coverage-report-2026-04-17.md
