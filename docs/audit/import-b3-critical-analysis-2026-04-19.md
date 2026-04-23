# Analise Critica - Importacao B3 Movimentacao

Data: 2026-04-19
Status: Prioridade maxima (V2)

## Objetivo
Estabilizar a importacao da planilha de Movimentacao B3 e garantir interconexao consistente com os modulos de Contas, Ativos, Transacoes, Ledger e Posicoes.

## Escopo analisado
- Parser e classificacao: src/modules/b3/parser/movimentacao.ts
- Servico de importacao: src/modules/b3/service.ts
- Wizard/acoes: src/app/(app)/import/actions.ts e src/app/(app)/import/import-page-client.tsx
- Modulo de contas: src/app/(app)/accounts/* e src/modules/accounts/service.ts
- Testes de fluxo: __tests__/modules/b3/import-movimentacao-flow.test.ts e __tests__/modules/b3/import-review-flow.test.ts

## Achados criticos

### 1) Conta criada na importacao sem UX clara de edicao
- Sintoma: conta e criada/reutilizada na importacao por instituicao, mas usuario nao conseguia editar no modulo de contas.
- Causa: service ja tinha updateAccount, porem UI de /accounts nao expunha rota/acao de edicao.
- Impacto: contas importadas ficam com nomes/tipos pouco ajustaveis no fluxo de uso.
- Acao aplicada em 19/04:
  - rota de edicao criada: src/app/(app)/accounts/[id]/edit/page.tsx
  - server action criada: src/app/(app)/accounts/[id]/edit/actions.ts
  - link de edicao no card: src/components/AccountCard.tsx

### 2) Qualidade de cadastro de ativo no fluxo de movimentacao
- Sintoma: importacao de movimentacao pode criar ativo com nome igual ao ticker.
- Causa tecnica: upsertAssetFromImport recebe (ticker, ticker, category) em parte do fluxo, sem priorizar nome limpo de produto.
- Impacto: catalogo de ativos perde qualidade semantica e dificulta reconciliacao manual.
- Acao aplicada em 19/04 (fluxo principal do wizard):
  - confirmacao de movimentacao agora extrai nome do ativo a partir de `original.produto`
  - fallback para ticker apenas quando nao houver nome util
  - teste de regressao adicionado em __tests__/modules/b3/import-review-flow.test.ts

### 3) Interconexao parcial entre modulos apos importacao
- Sintoma: usuario percebe inconsistencia entre importacao e visibilidade nos modulos.
- Evidencia: fluxo tecnico cria transacao/ledger e conta/instituicao, mas faltam validacoes de integridade ponta-a-ponta em testes de regressao de UI.
- Impacto: regressao silenciosa entre importacao e telas de operacao.
- Acao recomendada:
  - criar testes de contrato entre importacao e leitura nas telas de contas/ativos/posicoes
  - incluir casos com instituicoes multiplas e conta explicita vs inferida

### 4) Documentacao funcional desalinhada
- Sintoma: docs/modules/import-b3.md ainda descreve partes de fluxo antigo.
- Impacto: orientacao operacional incorreta para manutencao e suporte.
- Acao recomendada:
  - alinhar documento ao fluxo atual de analise -> revisao -> confirmacao
  - marcar claramente o que esta desabilitado no fluxo direto

## Plano de execucao subsequente (ordem)
1. Consolidar UX de Contas para entidades importadas (edicao, validacao e feedback).
2. Corrigir qualidade de cadastro de ativo no importMovimentacao (nome do produto + fallback).
3. Adicionar suite de regressao de interconexao importacao -> modulos.
4. Atualizar docs e memoria com estado validado por testes.

## Criterios de aceite da fase critica
- Usuario consegue editar contas criadas pela importacao no modulo Contas.
- Movimentacao cria/atualiza ativo com nome coerente quando houver produto valido.
- Testes cobrindo importacao e reflexo em contas/ativos/posicoes verdes.
- Documentacao de importacao refletindo o fluxo real.
