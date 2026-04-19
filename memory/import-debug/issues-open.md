# Issues Abertas - Import Debug

## Abertas

### ID: IMP-001
- Titulo: Fluxo de depuracao ainda sem primeira execucao real registrada
- Tipo: processo de observacao
- Severidade: media
- Status: aberta
- Evidencia: nesta sessao foram mapeados codigo, testes e documentacao, mas nenhuma importacao real foi executada.
- Impacto: ainda nao ha comparacao empirica entre planilha, banco e dashboard.
- Proximo teste sugerido: executar uma importacao real de cada tipo de planilha e preencher os registros dedicados.

### ID: IMP-002
- Titulo: Necessidade de validar divergencia banco -> dashboard apos importacao
- Tipo: interligacao
- Severidade: alta
- Status: aberta
- Evidencia: o codigo confirma persistencia e recalcPositions em negociacao/movimentacao, mas a refletividade final no dashboard nao foi verificada nesta sessao.
- Impacto: pode haver incoerencia entre dados persistidos e visualizacao final.
- Proximo teste sugerido: apos cada importacao real, comparar tabelas afetadas, tela de posicoes e dashboard.

### ID: IMP-003
- Titulo: Persistencia de posicao em tabela dedicada nao confirmada
- Tipo: modelagem/armazenamento
- Severidade: media
- Status: aberta
- Evidencia: schema verificado nao mostrou model Position persistido; o fluxo confirmado de posicao faz upsert de ativos e nao cria transacoes.
- Impacto: a reconciliacao entre planilha de posicao e visualizacao pode depender de calculo derivado, nao de persistencia direta.
- Proximo teste sugerido: importar planilha real de posicao e verificar como a tela de posicoes e o dashboard refletem o resultado.

### ID: IMP-004
- Titulo: Historico de falha critica de interligacao na importacao de movimentacao
- Tipo: interligacao
- Severidade: critica
- Status: aberta
- Evidencia: memory/current-state.md e docs/audit/import-b3-critical-analysis-2026-04-19.md registram falhas criticas entre importacao e modulos operacionais.
- Impacto: contas, ativos e posicoes podem divergir do esperado apos importacao real.
- Proximo teste sugerido: executar importacao real de movimentacao e registrar ponta a ponta o reflexo em contas, ativos, transacoes, ledger, posicoes e dashboard.

### ID: IMP-005
- Titulo: Relato de importacao de movimentacao sem trilha persistida correspondente
- Tipo: persistencia/auditoria
- Severidade: critica
- Status: aberta
- Evidencia: na verificacao realizada em 2026-04-19 com o cliente Prisma real do projeto, nao foi encontrado AuditLog com entityType IMPORT_B3_MOVIMENTACAO, nem Transaction com notes de Importacao B3 - Movimentacao, nem LedgerEntry associado; no mesmo ambiente foi encontrado AuditLog recente de IMPORT_B3_NEGOCIACAO em 2026-04-19T13:21:41.136Z.
- Impacto: nao ha base confiavel para afirmar que a planilha de movimentacao foi registrada, conciliada ou refletida corretamente no sistema.
- Proximo teste sugerido: repetir a importacao com identificacao do arquivo e conferir imediatamente AuditLog, Transaction, LedgerEntry, contas afetadas e reflexo nas telas.

## Critérios de fechamento

- Nao fechar item sem evidencia direta em planilha real, banco e interface.
- Quando um item for reproduzido, adicionar data/hora, arquivo, mensagens exatas e tabelas impactadas.
- Quando um item nao reproduzir, registrar explicitamente o cenario testado antes de reclassificar.