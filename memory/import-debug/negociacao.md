# Registro de Importacao

## Identificacao
- Tipo: negociacao
- Arquivo: nao verificado
- Data/hora: nao verificado
- Origem: nao verificado
- Observacoes iniciais: nenhum arquivo real registrado nesta sessao.

## Etapa 1: Leitura e parsing
- Parser usado: parseNegociacao / analyzeNegociacaoRows (verificado no codigo)
- Campos reconhecidos: data, tipo de movimentacao, mercado, instituicao, codigo de negociacao, quantidade, preco, valor (verificado na documentacao tecnica)
- Campos ausentes: nao verificado em arquivo real
- Regras aplicadas: compra -> BUY; venda -> SELL; mercado fracionario remove sufixo F do ticker; resolucao manual para ativos nao cadastrados (verificado no codigo/documentacao)
- Decisoes automaticas: criacao/reuso de instituicao e conta; sugestao/criacao de classes de ativo; associacao ou criacao de ativo; idempotencia por referenceId/hash (verificado no codigo)

## Etapa 2: Banco de dados
- Tabelas afetadas: Client, Institution, Account, AssetClass, Asset, Transaction, LedgerEntry, AuditLog (verificado no codigo)
- Registros criados: nao verificado em importacao real nesta sessao
- Registros atualizados: nao verificado em importacao real nesta sessao
- Registros ignorados: nao verificado em importacao real nesta sessao
- Relacoes criadas: Account -> Institution -> Client; Transaction -> Account/Asset; LedgerEntry -> Transaction/Account (verificado no codigo)
- Relacoes quebradas ou ausentes: nao verificado em importacao real nesta sessao

## Etapa 3: Interligacao entre modulos
- Contas: criadas/reutilizadas automaticamente por instituicao e nome de conta (verificado no codigo)
- Ativos: podem ser criados ou associados via wizard (verificado no codigo)
- Instituicoes: criadas ou reutilizadas automaticamente (verificado no codigo)
- Posicoes: recalcPositions e chamado apos importacao confirmada (verificado no codigo)
- Ledger/Transacoes: transacao e ledger sao gerados no fluxo confirmado (verificado no codigo)
- Income: nao verificado como alterado por negociacao nesta sessao
- Insights: nao verificado nesta sessao
- Dashboard: nao verificado nesta sessao

## Etapa 4: Erros
- Erros encontrados: nenhum novo erro executado nesta sessao
- Mensagens exatas: nao verificado
- Onde ocorreu: nao verificado
- Severidade: nao verificado
- Reproduzivel?: nao verificado

## Etapa 5: Conclusao
- O que funcionou: mapeamento estatico do fluxo real de negociacao foi documentado.
- O que falhou: nenhuma importacao real executada; nao ha validacao empirica nesta sessao.
- Impacto: sem evidencia nova de producao ou teste manual nesta sessao.
- Proximo passo: executar importacao real de negociacao e preencher este registro com evidencias observadas.