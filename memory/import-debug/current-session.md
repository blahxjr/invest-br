# Sessao Atual de Depuracao de Importacao

Status: ativo
Data de abertura: 2026-04-19
Objetivo: observar, registrar, comparar e organizar evidencias das importacoes reais de negociacao, movimentacao e posicao, sem aplicar correcoes automaticas nesta fase.

## Escopo confirmado

- Tipos de planilha sob depuracao: negociacao, movimentacao e posicao.
- Fluxo de upload ativo: rota /import com wizard no client.
- Fluxo direto desabilitado para movimentacao e posicao nas Server Actions.
- Auditoria existente no sistema: tabela AuditLog para lotes de importacao confirmados.

## Fluxo real verificado no codigo

- Negociacao:
  - leitura do arquivo em src/app/(app)/import/actions.ts
  - parser: parseNegociacao / analyzeNegociacaoRows
  - confirmacao: confirmAndImportNegociacao / confirmAndImportNegociacaoForUser
- Movimentacao:
  - leitura do arquivo em src/app/(app)/import/actions.ts
  - parser/revisao: parseMovimentacaoForReview / analyzeMovimentacaoRows
  - confirmacao: confirmAndImportMovimentacao / confirmAndImportMovimentacaoForUser
- Posicao:
  - leitura do arquivo em src/app/(app)/import/actions.ts
  - parser/revisao: parsePosicaoForReview / analyzePosicaoRows
  - confirmacao: confirmAndImportPosicao / confirmAndImportPosicaoForUser

## Tabelas verificadas como relevantes

- Client
- Institution
- Account
- AssetClass
- Asset
- Transaction
- LedgerEntry
- IncomeEvent
- RentalReceipt
- AuditLog

## Interligacoes verificadas no codigo

- Negociacao confirmada: cria/resolve institution e account, cria/resolve asset, cria Transaction, cria LedgerEntry e chama recalcPositions por conta afetada.
- Movimentacao confirmada: cria/resolve institution e account, cria/resolve asset, chama createTransaction, grava AuditLog e chama recalcPositions por conta afetada.
- Posicao confirmada: cria/resolve institution e account, faz upsert de Asset e grava AuditLog.
- Atualizacao direta de dashboard apos importacao: nao verificado nesta sessao.
- Persistencia de Position em tabela dedicada: nao verificado no schema atual.

## Riscos e pontos abertos ja confirmados antes da proxima importacao

- Importacao de movimentacao e prioridade critica do projeto devido a falhas de interconexao entre modulos.
- Qualidade de cadastro de ativo em movimentacao ja teve mitigacao parcial via nome derivado de produto no fluxo principal do wizard.
- Divergencia final entre banco e dashboard depende de execucao real e ainda nao esta verificada nesta sessao.

## Protocolo obrigatorio para cada nova importacao

1. Identificar tipo, arquivo, horario e observacoes iniciais.
2. Registrar parser, validacoes, mapeamentos, campos ausentes e decisoes automaticas.
3. Comparar o que foi persistido no banco com o que entrou no wizard.
4. Verificar interligacao entre contas, ativos, instituicoes, transacoes, ledger, posicoes, income, insights e dashboard.
5. Registrar erros exatos e divergencias entre planilha, banco e interface.
6. Atualizar issues-open.md para toda inconsistenciа nao resolvida.

## Estado atual

- Nenhuma nova importacao real foi executada nesta sessao de depuracao.
- Nenhum erro novo foi reproduzido nesta sessao de depuracao.
- Qualquer comportamento nao listado acima deve ser tratado como nao verificado ate execucao real.