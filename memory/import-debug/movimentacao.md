# Registro de Importacao

## Identificacao
- Tipo: movimentacao
- Arquivo: nao verificado
- Data/hora: nao verificado
- Origem: nao verificado
- Observacoes iniciais: nenhuma planilha real registrada nesta sessao. Este arquivo parte de evidencias de codigo, testes e memoria do projeto.

## Etapa 1: Leitura e parsing
- Parser usado: parseMovimentacaoForReview / analyzeMovimentacaoRows (verificado no codigo)
- Campos reconhecidos: entrada/saida, data, movimentacao, produto, instituicao, quantidade, preco unitario, valor da operacao (verificado na documentacao tecnica)
- Campos ausentes: nao verificado em arquivo real
- Regras aplicadas: classificacao em LIQUIDACAO, PROVENTO, EVENTO_CORPORATIVO, IGNORAR ou REVISAR; validacao de ticker, instituicao, tipo, quantidade, valor total e movimentacao de origem; geracao de review file e decision log (verificado no codigo)
- Decisoes automaticas: autopreenchimento de conta quando ha unica conta por instituicao; criacao/reuso de instituicao e conta; criacao/reuso de ativo; skip por idempotencia; recalcPositions apos importacao (verificado no codigo)

## Etapa 2: Banco de dados
- Tabelas afetadas: Client, Institution, Account, Asset, Transaction, LedgerEntry, AuditLog (verificado no codigo)
- Registros criados: nao verificado em importacao real nesta sessao
- Registros atualizados: nao verificado em importacao real nesta sessao
- Registros ignorados: linhas com action SKIP, linhas invalidas e importacoes idempotentes sao ignoradas no fluxo confirmado (verificado no codigo)
- Relacoes criadas: Account -> Institution -> Client; Transaction -> Account/Asset; LedgerEntry -> Transaction/Account (verificado no codigo)
- Relacoes quebradas ou ausentes: nao verificado em importacao real nesta sessao

## Etapa 3: Interligacao entre modulos
- Contas: importacao resolve ou cria conta por instituicao; havia historico de falha de UX para editar conta importada, mitigado em 19/04/2026 (verificado em memoria e auditoria)
- Ativos: fluxo confirmado usa nome derivado de original.produto com fallback para ticker no wizard principal (verificado no codigo)
- Instituicoes: criadas/reutilizadas automaticamente (verificado no codigo)
- Posicoes: recalcPositions e chamado por conta afetada (verificado no codigo)
- Ledger/Transacoes: createTransaction e usado no fluxo confirmado; ledger e derivado do servico de transacoes (verificado no codigo)
- Income: nao confirmado como atualizado diretamente por este fluxo alem de transacoes de tipo DIVIDEND/INCOME
- Insights: nao verificado nesta sessao
- Dashboard: nao verificado nesta sessao

## Etapa 4: Erros
- Erros encontrados: sem nova reproducao nesta sessao; existem riscos criticos historicos de interligacao documentados no projeto.
- Mensagens exatas: nao verificado nesta sessao
- Onde ocorreu: nao verificado nesta sessao
- Severidade: nao verificado nesta sessao
- Reproduzivel?: nao confirmado nesta sessao

## Etapa 5: Conclusao
- O que funcionou: fluxo real do wizard, persistencia, auditoria e pontos de recalc foram mapeados com base no codigo.
- O que falhou: nenhuma execucao real foi observada ainda; estado de dashboard e consistencia final ainda nao foram medidos nesta sessao.
- Impacto: movimentacao continua sendo o foco critico de depuracao do projeto.
- Proximo passo: executar importacao real de movimentacao e comparar planilha, linhas do wizard, banco, modulos operacionais e dashboard.