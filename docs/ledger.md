# Ledger Engine (Double-Entry)

## Conceito

O Ledger Engine implementa partidas dobradas para transacoes financeiras.
Cada transacao financeira gera dois lancamentos:

- 1 debito
- 1 credito

Regra central:

- soma(debitos) == soma(creditos)

Se divergir, a operacao e bloqueada.

## Plano de contas

Contas minimas do projeto:

- Ativos
  - Caixa (`ASSET_CASH`)
  - Investimentos (`ASSET_INVESTMENTS`)
- Receitas
  - Rendimentos FII (`INCOME_FII_RENTS`)
  - Dividendos (`INCOME_DIVIDENDS`)
  - Juros (`INCOME_INTEREST`)

Contas auxiliares de operacao:

- Patrimonio
  - Aportes de Capital (`EQUITY_CAPITAL_CONTRIBUTIONS`)
- Despesas
  - Saques (`EXPENSE_WITHDRAWALS`)

## Regras de contabilizacao

- BUY
  - Debito: Investimentos
  - Credito: Caixa
- SELL
  - Debito: Caixa
  - Credito: Investimentos
- INCOME / DIVIDEND / RENT
  - Debito: Caixa
  - Credito: Receita (Rendimentos FII, Dividendos ou Juros)
- MATURITY
  - Debito: Caixa
  - Credito: Investimentos
- DEPOSIT
  - Debito: Caixa
  - Credito: Aportes de Capital
- WITHDRAWAL
  - Debito: Saques
  - Credito: Caixa

Eventos sem impacto financeiro (nao geram lancamento):

- CUSTODY_TRANSFER
- SUBSCRIPTION_RIGHT
- CORPORATE_UPDATE
- SPLIT
- BONUS_SHARES

## Validacao obrigatoria

Antes de persistir os lancamentos:

- `validateDoubleEntry(entries)`

Se `sum(debits) !== sum(credits)`, a transacao falha com erro critico.

## Extrato bancario

`getAccountStatement(accountId)` retorna linhas ordenadas por data com:

- data
- descricao
- debito
- credito
- saldo acumulado

O extrato e baseado em movimentos da conta contabil Caixa para representar fluxo financeiro real.

## Exemplos

- Compra de acao (R$ 1.000)
  - Debito Investimentos: 1.000
  - Credito Caixa: 1.000
- Venda de acao (R$ 500)
  - Debito Caixa: 500
  - Credito Investimentos: 500
- Dividendo (R$ 120)
  - Debito Caixa: 120
  - Credito Dividendos: 120
