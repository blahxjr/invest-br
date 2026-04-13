Invest‑BR – Módulos e Telas
Este documento descreve os módulos funcionais do Invest‑BR e suas principais telas, conectando a visão de produto ao modelo de dados.

1. Módulo Cadastro
1.1. Meu Perfil / Conta
Objetivo: permitir que o usuário ajuste sua identidade e preferências.

Conteúdo:

nome, e‑mail;

tipo de usuário (INVESTIDOR, CONSULTOR);

plano (FREE, PRO, CONSULTOR);

preferências gerais (moeda padrão, tema claro/escuro).

Entidades relacionadas:

User.

1.2. Clientes (para consultor)
Objetivo: gerenciar os clientes atendidos pelo consultor.

Lista:

nome, documento (opcional), número de carteiras, patrimônio total estimado.

Detalhe:

dados do cliente;

lista de carteiras (Portfolio);

lista de contas (Account).

Ações:

criar cliente;

editar dados;

arquivar/reativar.

Entidades relacionadas:

Client, Portfolio, Account.

1.3. Carteiras
Objetivo: organizar o patrimônio em carteiras com objetivos diferentes.

Lista:

nome da carteira, objetivo, patrimônio total, flag de carteira principal.

Detalhe:

dados básicos (nome, descrição, objetivo);

contas ligadas a essa carteira;

atalho para dashboard da carteira.

Ações:

criar carteira;

definir carteira principal;

vincular/desvincular contas.

Entidades relacionadas:

Client, Portfolio, Account, Position.

1.4. Instituições e Contas
Objetivo: registrar onde os ativos estão custodiados.

Tela de instituições:

lista com nome, tipo (banco, corretora, cripto etc.), país.

Tela de contas:

para um cliente, lista de contas:

instituição, nome da conta, número, carteira associada, moeda, status.

Ações:

cadastrar instituição (quando não vier de integração);

cadastrar conta;

vincular conta a uma carteira;

ativar/desativar conta.

Entidades relacionadas:

Institution, Account, Client, Portfolio.

1.5. Catálogo de Ativos
Objetivo: permitir buscar e entender os ativos já cadastrados, além de criar ativos especiais.

Busca:

por nome, ticker, CNPJ, tipo, classe, identificadores.

Lista:

nome, classe (AssetClass), tipo (assetType), moeda, risco, liquidez.

Detalhe:

metadados do ativo;

lista de identificadores (AssetIdentifier);

notas.

Ações:

criar ativo manual (para ativos fora de bolsa – imóveis, veículos, bens reais);

editar metadados não sensíveis.

Entidades relacionadas:

AssetClass, Asset, AssetIdentifier.

2. Módulo Movimentações
2.1. Lançamentos / Transações
Objetivo: registrar e visualizar transações (compras, vendas, aportes, saques, proventos, taxas, impostos).

Lista:

data, tipo, ativo, conta, valor, quantidade, origem (manual, CSV, integração).

Filtros:

por período, tipo, ativo, conta, carteira, fonte.

Ações:

lançar transação manual;

editar (quando permitido) ou criar ajustes;

visualizar impacto em posição.

Entidades relacionadas:

Transaction, Client, Account, Asset, Portfolio.

2.2. Importações
Objetivo: importar extratos e dados de outras plataformas (CSV, Open Finance, APIs).

Tela de jobs:

lista de importações: fonte/arquivo, data, status (novo, em processamento, concluído, com erros).

Detalhe do job:

pré‑visualização das linhas;

tenta mapear:

contas (para Account);

ativos (para Asset via AssetIdentifier).

conciliação:

escolher ativo existente ou criar novo quando não houver correspondência;

revisar linhas com erro.

Ações:

confirmar aplicação (gerar Transaction e LedgerEntry);

descartar job.

Entidades relacionadas:

Transaction, LedgerEntry, Account, Asset, AssetIdentifier.

3. Módulo Carteira / Posições
3.1. Dashboard da Carteira
Objetivo: dar uma visão rápida da saúde da carteira.

Indicadores:

patrimônio total;

patrimônio por carteira (quando visto no nível do cliente);

patrimônio por classe de ativo (gráfico de pizza ou barras);

P/L total e percentual;

top ativos por valor ou P/L.

Seções:

visão por carteira;

visão por classe (Renda Fixa, Fundos, FIIs, Cripto, Bens Reais etc.);

visão por moeda/país.

Entidades relacionadas:

Client, Portfolio, Position, Asset, AssetClass.

3.2. Posições Detalhadas
Objetivo: detalhar posição por ativo, conta e carteira.

Tabela:

ativo, conta, carteira, quantidade, preço médio, custo, preço de mercado, valor de mercado, P/L, risco, liquidez.

Filtros:

por carteira, conta, classe de ativo, moeda, país.

Ações:

abrir detalhe do ativo (vai para Catálogo de Ativos);

ver histórico de transações daquele ativo.

Entidades relacionadas:

Position, Asset, AssetClass, Account, Portfolio, Client, Transaction.

4. Módulos futuros (nível de rascunho)
4.1. Insights e Rebalanceamento
Cards de insights:

concentração excessiva (ativo, classe, país/moeda);

ativos com baixa liquidez em peso alto;

desalinhamento de prazo vs objetivo da carteira;

sugestão de rebalanceamento (ex.: reduzir classe X, aumentar classe Y).

Base de dados:

Position, Asset, AssetClass, regras e parâmetros configuráveis.

4.2. Notícias e Conteúdo
Feed de notícias por:

classe de ativo, ativo específico, tema macro.

Objetivo:

dar contexto sem virar recomendação direta.

4.3. Relatórios
Relatórios em PDF/Excel:

posição consolidada por carteira;

histórico de transações por período;

visão por cliente (para consultores).

4.4. Configuração de Insights
Objetivo: permitir ativar/desativar tipos de insight e ajustar limites percentuais por escopo.

Tela PF: Minhas Regras de Insights

lista dos tipos de insight ativos no catálogo;

switch ligar/desligar por tipo;

campo numérico (%) para limite por tipo;

persistência no escopo USER.

Tela Consultor: Perfis de Insights

lista de perfis de configuração;

CRUD de perfil (nome, escopo, ativo/inativo);

edição de regras por tipo (enabled, threshold, severidade);

atribuição opcional de perfil para clientes e carteiras.

Resolução de perfil efetivo:

Portfolio > Client > User > Global;

fallback para default do catálogo de InsightType quando não houver regra.

Entidades relacionadas:

InsightType, InsightConfigProfile, InsightConfigRule, User, Client, Portfolio.