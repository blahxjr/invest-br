Invest‑BR – Visão Geral e Arquitetura
1. Visão do produto
O Invest‑BR é uma plataforma para escriturar e acompanhar todo o patrimônio financeiro de um usuário ou cliente de consultor, incluindo ativos bancários e não bancários (imóveis, veículos, bens reais, alternativos, cripto etc.).

O objetivo é centralizar informações que hoje estão espalhadas em bancos, corretoras, carteiras e controles manuais, permitindo uma visão única da carteira e decisões mais conscientes.

Principais objetivos:

Consolidar posições por cliente, carteira, conta, ativo e classe.

Atualizar valores dos ativos sempre que possível, via integrações e entradas manuais.

Gerar insights sobre risco, concentração, liquidez, prazo e necessidade de rebalanceamento.

Oferecer uma interface simples, bonita e escalável, que suporte evolução futura (novas classes de ativos, integrações, funcionalidades avançadas).

Perfis de usuário:

Investidor pessoa física autodidata
Tem múltiplas contas em bancos e corretoras, com vários tipos de investimentos (CDB, fundos, FIIs, ações, cripto, imóveis, veículos etc.), e dificuldade de enxergar tudo em um lugar só.

Consultor / planejador financeiro autônomo
Atende vários clientes e precisa de uma ferramenta neutra para registrar, acompanhar e analisar carteiras sem depender das plataformas das corretoras.

Modelo de negócio (visão inicial):

Acesso gratuito para funcionalidades principais.

Monetização via:

anúncios e notícias financeiras,

assinatura avançada (mais insights, relatórios, multi‑cliente para consultores).

2. Stack e decisões técnicas principais
Frontend:

Next.js (App Router) + React + TypeScript para a aplicação web principal.

Tailwind CSS para estilização consistente, temas e componentes reutilizáveis.

Backend:

API interna do Next.js, organizada por módulos de domínio (cadastro, carteiras, transações, importação, market data, insights).

Casos de uso explícitos para operações críticas:

criação de clientes, carteiras, contas,

lançamentos de transações e proventos,

importação de extratos e conciliação,

cálculo de posições e P/L.

Banco de dados e ORM:

PostgreSQL como banco relacional principal.

Prisma como camada de schema e acesso a dados.

Qualidade:

Vitest para testes automatizados.

Lint, formatador e type‑check integrados ao fluxo padrão de desenvolvimento.

3. Modelo de domínio – visão geral
A modelagem do Invest‑BR é construída em torno de três eixos:

Quem é o dono das carteiras (usuários e clientes).

Onde os ativos estão (instituições e contas).

O que são os ativos e como se movimentam (multi‑ativo + ledger).

3.1. Usuários, clientes e carteiras
User
Representa a conta de acesso ao sistema (investidor, consultor, admin), com plano (free, pro, consultor) e preferências gerais.

Client
Representa o “dono” da carteira.

Para um investidor pessoa física, o próprio usuário pode ser um único client.

Para um consultor, um User pode ter vários Client, um para cada cliente atendido.

Portfolio
Carteiras ou subcarteiras lógicas de um Client (ex.: “Pessoal”, “Aposentadoria”, “Filhos”, “Empresa X”).

Essas entidades permitem:

separar o contexto de investidor final e consultor,

organizar o patrimônio em carteiras com objetivos diferentes.

3.2. Instituições e contas
Institution
Cadastro de bancos, corretoras, custodians, carteiras cripto e outros intermediários.

Account
Conta específica de um Client em uma Institution, opcionalmente associada a uma Portfolio.
Ex.: “XP – conta principal”, “Nubank – conta corrente”, “Binance – spot”.

Isso permite mapear os mesmos ativos distribuídos em várias instituições e contas sob uma visão única.

4. Núcleo multi‑ativo (asset master)
O Invest‑BR precisa suportar uma gama ampla de investimentos (Renda Fixa, ações, fundos, FIIs, cripto, bens reais, alternativos).

A abordagem escolhida é um modelo multi‑ativo unificado:

4.1. Classes de ativos
AssetClass
Representa grandes classes e famílias de investimento, alinhadas à planilha “Tipos de Investimentos Expandido”.

Exemplos de classes:

Renda Fixa (pública, privada, securitização),

Fundos (abertos, estruturados, previdência),

Fundos Imobiliários (papel, tijolo, híbrido),

Ações e renda variável (Brasil, exterior, ETFs, BDRs, REITs),

Criptoativos (Bitcoin, altcoins, stablecoins, NFTs),

Bens reais (imóveis, veículos, arte, metais, colecionáveis),

Ativos alternativos (private equity, venture capital, hedge funds).

Cada classe traz metadados padrão, como risco base, liquidez base e horizonte recomendado, que podem ser refinados no nível do ativo.

4.2. Cadastro de ativos
Asset
Cada linha representa um ativo específico, com atributos genéricos:

classe (assetClass),

tipo dentro da classe (ex.: TESOURO_SELIC, CDB, FII_TIJOLO, ETF_ACOES, BITCOIN, IMOVEL_RESIDENCIAL),

nome e símbolo exibido,

moeda e país,

risco, liquidez e horizonte recomendado (podem herdar defaults da classe),

status ativo/inativo,

origem do cadastro (manual, CVM, ANBIMA, B3, Open Finance, APIs de cripto).

A ideia é que ativos bancários e não bancários convivam no mesmo modelo, com extensões específicas criadas somente quando necessário (por exemplo, detalhes adicionais para imóveis e veículos).

4.3. Identificadores únicos de ativos
AssetIdentifier
Tabela de identificadores oficiais e internos, que permite integrar múltiplas fontes sem duplicar ativos.
Exemplos de tipos de identificador:

tickers (B3, bolsas estrangeiras),

CNPJ de fundo ou empresa,

ISIN,

códigos CVM/ANBIMA,

símbolos de cripto,

IDs de produto em Open Finance,

códigos internos do próprio sistema.

Regra central:

há um índice único em (idType, value);

qualquer importação ou integração deve buscar primeiro em AssetIdentifier antes de criar um novo Asset, reduzindo risco de duplicação.

5. Movimentações, ledger e posições
5.1. Transações
Transaction
Representa o evento que o usuário entende: compra, venda, aporte, saque, provento, taxa, imposto, ajuste etc.
Ligada a:

um Client,

uma Account,

opcionalmente a um Asset (nem toda transação precisa envolver um ativo, ex.: depósito em dinheiro).

Campos principais:

tipo (TransactionType: BUY, SELL, DEPOSIT, WITHDRAW, INCOME, FEE, TAX, ADJUSTMENT),

direção (MoneyDirection: INFLOW, OUTFLOW, NEUTRAL),

datas (efetiva, contábil),

quantidade, preço, valores bruto e líquido,

moeda,

taxas e impostos,

origem (manual, CSV, Open Finance, API),

chave de idempotência para evitar duplicatas em importações.

5.2. Ledger (lançamentos contábeis)
LedgerEntry
Lançamentos derivados de uma Transaction, associando client, account, portfolio e asset ao efeito monetário.
Prepara o terreno para contabilidade mais robusta (débito/crédito, reversões, auditoria).

5.3. Posições consolidadas
Position
Posição atual por cliente, carteira, conta e ativo.
Campos principais:

quantidade e custo médio,

custo total,

preço de mercado e valor de mercado,

P/L não realizado (valor de mercado – custo) e percentual,

moeda e data de última atualização.

Position é a base direta dos dashboards e dos módulos de insights.

6. Módulos funcionais e telas
6.1. Módulo Cadastro
Meu Perfil / Conta:

dados do usuário, papel (investidor/consultor), plano, preferências.

Clientes (para consultores):

lista e detalhe de clientes, com visão de carteiras e patrimônio.

Carteiras:

criar e editar carteiras por cliente.

Instituições e Contas:

cadastro de instituições e contas, vínculo com carteiras.

Catálogo de Ativos:

busca e visualização de Asset + AssetIdentifier, criação manual de ativos especiais.

6.2. Módulo Movimentações
Lançamentos / Transações:

listagem e cadastro de Transaction por conta/carteira.

Importações:

jobs de importação (CSV, integrações), pré‑visualização, conciliação e aplicação, com idempotência.

6.3. Módulo Carteira / Posições
Dashboard:

patrimônio total, por carteira e por classe de ativo; P/L; top ativos por valor.

Posições detalhadas:

tabela com Position por ativo/conta/carteira, filtros e acesso ao histórico de transações.

Módulos futuros incluem: Insights/Rebalanceamento, Notícias/Conteúdo e Relatórios, construídos sobre o modelo de dados descrito aqui.

7. Papel da IA e agents neste projeto
Na camada de desenvolvimento:

Agentes de IA (Copilot e outros) usam este documento como contexto primário para:

criar e evoluir schemas Prisma,

implementar e refatorar casos de uso,

escrever testes e documentação alinhados ao modelo.

Na camada de produto:

Módulos de insights e explicações usam:

Position, Transaction, Asset/AssetClass e metadados (risco, liquidez, horizonte) para:

identificar concentração excessiva,

desalinhamento de risco e prazo,

problemas de liquidez,

oportunidades de rebalanceamento e ajustes.

A IA deve sempre operar sobre dados reais do banco e respeitar as regras de negócio definidas neste documento.