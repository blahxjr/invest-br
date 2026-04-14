# Handoff — InvestBR

## Resumo executivo
InvestBR e um sistema web para gestao de investimentos com ledger rastreavel, posicoes calculadas em memoria e dashboard consolidado.
O projeto esta em estado estavel de MVP avancado com importacao B3, modulo de posicoes com cotacoes e tela de rentabilidade.
A base tecnica esta padronizada em Next.js 16, Prisma 7 com adapter pg, PostgreSQL e testes Vitest.
Na auditoria deste checkpoint: 124 testes passaram, 0 falharam, 0 foram pulados e o build de producao passou sem erros de TypeScript.
O proximo ciclo (Fase 3) foca evolucao funcional de UX e operacao: filtros, edicao/exclusao, paginacao, insights e polish.

## Como iniciar uma nova sessao
Diga ao assistente:
> "Estou continuando o desenvolvimento do InvestBR.
> Leia memory/current-state.md e memory/handoff.md antes de prosseguir."

## Contexto critico que nao esta no codigo
- Decimal.js e usado para evitar erro de arredondamento financeiro; number nativo nao e aceitavel para custo medio, P&L e agregacoes monetarias.
- @prisma/adapter-pg e obrigatorio no Prisma 7; sem adapter o PrismaClient falha na inicializacao.
- jsdom e configurado por arquivo de teste de componente porque o match por glob nao foi confiavel neste setup.
- BRAPI_TOKEN e opcional para funcionar em dev, mas recomendado para reduzir risco de rate limit.
- Toda prop com Decimal deve ser serializada para string/number antes de atravessar Server -> Client (DEC-016).

## Stack de prompts concluidos
| Prompt | Escopo | Testes adicionados |
|--------|--------|--------------------|
| 1-7    | Fundacao (schema, auth, contas, txs, proventos) | ~97 |
| 8      | Import B3 (XLSX, 3 tipos de planilha) | +10 |
| 9      | Posicoes (custo medio ponderado, BDR) | +5 |
| 10     | Dashboard v2 (alocacao, N+1 eliminado) | +7 |
| 11     | Cotacoes Brapi (P&L, valor de mercado) | +6 |
| 12     | Rentabilidade (/performance, snapshots, grafico) | +5 |

## Proximos prompts (Fase 3)
| # | Modulo | Escopo resumido |
|---|--------|-----------------|
| 13 | Movimentacoes v2 | filtros por periodo, ativo e tipo |
| 14 | Edicao/Exclusao | transacoes e proventos |
| 15 | Paginacao | todas as listagens |
| 16 | Insights/Rebalanceamento | sugestoes on-the-fly (DEC-015) |
| 17 | Polish MVP | empty states, skeletons, responsividade |

## Arquivos que nunca devem ser alterados sem intencao
- prisma/schema.prisma -> sempre criar migration apos alterar.
- src/lib/quotes.ts -> fetch externo com fallback silencioso intencional.
- __tests__/helpers/fixtures.ts -> helper compartilhado, altera muitos testes indiretamente.
