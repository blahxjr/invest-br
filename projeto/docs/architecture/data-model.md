
Invest‑BR – Modelo de Dados
Este documento descreve o modelo de dados principal do Invest‑BR em nível de entidades, relacionamentos e decisões importantes para desenvolvimento, integrações e uso por agents.

1. Visão geral
O modelo de dados é organizado em três blocos principais:

Identidade e organização
User, Client, Portfolio.

Infraestrutura financeira
Institution, Account.

Ativos e movimentos
AssetClass, Asset, AssetIdentifier, Transaction, LedgerEntry, Position.

O objetivo é suportar um cenário multi‑cliente, multi‑carteira, multi‑instituição e multi‑ativo, com escrituramento rastreável via ledger e posições consolidadas para dashboards e insights.

2. Identidade: usuários, clientes e carteiras
2.1. User
Representa a conta de acesso ao sistema.

Campos principais:

id, email, name

role (INVESTIDOR, CONSULTOR, ADMIN)

plan (FREE, PRO, CONSULTOR)

Relacionamentos:

User 1‑N Client

investidor PF: 1 user → 1 client

consultor: 1 user → N clients

2.2. Client
Representa o “dono” da carteira (pessoa ou entidade).

Campos principais:

id, userId

name, documentId?, notes?

Relacionamentos:

Client 1‑N Portfolio

Client 1‑N Account

Client 1‑N Transaction

Client 1‑N LedgerEntry

Client 1‑N Position

2.3. Portfolio
Carteiras lógicas de um cliente.

Campos principais:

id, clientId

name, description?, goal?, isPrimary

Relacionamentos:

Portfolio N‑1 Client

Portfolio 1‑N Account (modelo simples inicial)

Portfolio 1‑N LedgerEntry

Portfolio 1‑N Position

3. Instituições e contas
3.1. Institution
Cadastro de bancos, corretoras, custodians, wallets etc.

Campos principais:

id

name, shortName?

type (BANCO, CORRETORA, CORRETORA_CRIPTO, WALLET_CRIPTO, OUTRO)

country?, website?

Relacionamentos:

Institution 1‑N Account

3.2. Account
Conta específica de um cliente em uma instituição.

Campos principais:

id

clientId

institutionId

portfolioId?

name, number?

currency

isActive

Relacionamentos:

Account N‑1 Client

Account N‑1 Institution

Account N‑1 Portfolio?

Account 1‑N Transaction

Account 1‑N LedgerEntry

Account 1‑N Position

4. Núcleo multi‑ativo
4.1. AssetClass
Grandes classes de investimento, alinhadas à planilha “Tipos de Investimentos Expandido”.

Campos principais:

id

code (único)

name

riskLevelBase (BAIXO, MEDIO, ALTO, MUITO_ALTO)

liquidityBase (ALTA, MEDIA, BAIXA, MUITO_BAIXA)

description?

isAlternative (marca classes alternativas, como private equity, hedge funds etc.).

Relacionamentos:

AssetClass 1‑N Asset

4.2. Asset
Cada ativo/instrumento específico (WEGE3, Tesouro Selic, FII X, Bitcoin, imóvel, veículo etc.).

Campos principais:

id

assetClassId

name, shortName?

assetType (ex.: TESOURO_SELIC, CDB, FII_TIJOLO, ETF_ACOES, BITCOIN, IMOVEL_RESIDENCIAL)

currency, country?

riskLevel?, liquidity?, recommendedHorizon? (podem sobrescrever defaults da classe)

isActive

source (MANUAL, CVM, ANBIMA, B3, OPEN_FINANCE, CRYPTO_API etc.)

notes?

Relacionamentos:

Asset N‑1 AssetClass

Asset 1‑N AssetIdentifier

Asset 1‑N Transaction

Asset 1‑N LedgerEntry

Asset 1‑N Position

Asset 1‑N MarketQuote (no futuro)

4.3. AssetIdentifier
Cadastro de todos os identificadores do ativo em diferentes fontes.

Campos principais:

id

assetId

idType (TICKER_B3, TICKER_US, ISIN, CNPJ_FUNDO, CNPJ_EMPRESA, CVM_CODE, ANBIMA_CODE, SYMBOL_CRYPTO, OPEN_FINANCE_PRODUCT_ID, INTERNAL_CODE, etc.)

value

source (CVM, ANBIMA, B3, BINANCE, COINGECKO, OPEN_FINANCE, USER, etc.)

isPrimary

validFrom?, validTo?

Índices:

UNIQUE (idType, value) – evita duplicação de ativos.

Relacionamentos:

AssetIdentifier N‑1 Asset

5. Transações e ledger
5.1. Transaction
Evento econômico percebido pelo usuário.

Campos principais:

id

clientId, accountId, assetId?

type (BUY, SELL, DEPOSIT, WITHDRAW, TRANSFER_IN, TRANSFER_OUT, INCOME, FEE, TAX, ADJUSTMENT)

direction (INFLOW, OUTFLOW, NEUTRAL)

date, bookingDate?

quantity?, price?

grossAmount, netAmount, currency

feeAmount?, taxAmount?

description?, externalRef?

source (MANUAL, CSV, OPEN_FINANCE, CORRETORA_API)

idempotencyKey?

Índices:

UNIQUE (accountId, idempotencyKey) – garante idempotência de importações.

Relacionamentos:

Transaction N‑1 Client

Transaction N‑1 Account

Transaction N‑1 Asset?

Transaction 1‑N LedgerEntry

5.2. LedgerEntry
Lançamentos de ledger derivados de transações.

Campos principais:

id

transactionId

clientId, accountId, portfolioId?, assetId?

side (DEBIT, CREDIT)

quantityChange?

amountChange, currency

isReversal

notes?

Relacionamentos:

LedgerEntry N‑1 Transaction

LedgerEntry N‑1 Client

LedgerEntry N‑1 Account

LedgerEntry N‑1 Portfolio?

LedgerEntry N‑1 Asset?

6. Posições consolidadas
6.1. Position
Visão atual de posição por cliente, carteira, conta e ativo, derivada de lançamentos.

Campos principais:

id

clientId, portfolioId?, accountId, assetId

quantity

avgPrice?, costBasis

marketPrice?, marketValue?

unrealizedPnl?, pnlPct?

currency

lastUpdated

Índices:

UNIQUE (clientId, portfolioId, accountId, assetId) – evita múltiplas linhas para o mesmo escopo.

Relacionamentos:

Position N‑1 Client

Position N‑1 Portfolio?

Position N‑1 Account

Position N‑1 Asset

7. Regras importantes para desenvolvimento e agents
Sempre que criar ou importar um ativo, tentar mapear para um Asset existente via AssetIdentifier antes de criar um novo.

Nunca duplicar ativos com o mesmo identificador oficial (CNPJ, ticker, ISIN, código CVM/ANBIMA etc.).

Toda movimentação relevante deve passar por Transaction → LedgerEntry;
atualizações diretas em Position só devem ocorrer por processos de consolidação.

Para integrações (Open Finance, corretoras, CVM/ANBIMA):

mapear sempre identificadores externos para AssetIdentifier e Account;

usar idempotencyKey para evitar registrar duas vezes a mesma transação.