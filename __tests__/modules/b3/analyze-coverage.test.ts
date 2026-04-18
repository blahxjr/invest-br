import { describe, expect, it } from 'vitest'
import { validateTransactionConsistency, type AuditInput } from '../../../scripts/analyze-coverage'

describe('validateTransactionConsistency', () => {
  const baseSample: AuditInput = {
    movimentacao: 'Compra',
    entradaSaida: 'Debito',
    ticker: 'TESOURO',
    produto: 'Tesouro Prefixado com Juros Semestrais 2031',
    sourceFile: 'simulado.csv',
    monetaryValue: 1000,
    assetClass: 'RENDA_FIXA',
  }

  it('detecta entrada/saida invertida', () => {
    const result = validateTransactionConsistency(baseSample, {
      type: 'BUY',
      status: 'OK',
      classification: 'LIQUIDACAO',
      reason: 'compra',
      isIncoming: true,
      isTaxExempt: false,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('tipo_buy_inconsistente: BUY deve gerar isIncoming=false')
    expect(result.errors).toContain('entrada_saida_inconsistente: saida deve gerar isIncoming=false')
  })

  it('detecta BUY com credito como inconsistente', () => {
    const result = validateTransactionConsistency(
      {
        ...baseSample,
        entradaSaida: 'Credito',
        produto: 'CDB - CDB124661K5 - BANCO C6 CONSIGNADO S.A',
      },
      {
        type: 'BUY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'compra_renda_fixa',
        isIncoming: false,
        isTaxExempt: false,
      },
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('entrada_saida_inconsistente: entrada deve gerar isIncoming=true')
  })

  it('gera warning para transferencia de custodia com valor financeiro', () => {
    const result = validateTransactionConsistency(
      {
        ...baseSample,
        movimentacao: 'Transferência',
        entradaSaida: 'Credito',
        produto: 'PETR4 - PETROBRAS',
        ticker: 'PETR4',
        monetaryValue: 250,
      },
      {
        type: 'CUSTODY_TRANSFER',
        status: 'OK',
        classification: 'EVENTO_CORPORATIVO',
        reason: 'transferencia_generica',
        isIncoming: true,
        isTaxExempt: false,
      },
    )

    expect(result.isValid).toBe(true)
    expect(result.warnings).toContain('custody_transfer_com_valor: transferencia de custodia nao deve impactar caixa')
  })

  it('detecta SUBSCRIPTION_RIGHT com valor financeiro', () => {
    const result = validateTransactionConsistency(
      {
        ...baseSample,
        movimentacao: 'Direito de Subscrição',
        entradaSaida: 'Credito',
        monetaryValue: 100,
      },
      {
        type: 'SUBSCRIPTION_RIGHT',
        status: 'OK',
        classification: 'EVENTO_CORPORATIVO',
        reason: 'direito_subscricao_creditado',
        isIncoming: true,
        isTaxExempt: false,
      },
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('subscription_right_com_valor: direito de subscricao nao deve ter valor financeiro')
  })

  it('detecta renda fixa com semantica de vencimento incorreta', () => {
    const result = validateTransactionConsistency(
      {
        ...baseSample,
        movimentacao: 'Vencimento',
        entradaSaida: 'Credito',
        monetaryValue: 1050,
      },
      {
        type: 'MATURITY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'liquidacao_vencimento',
        isIncoming: false,
        isTaxExempt: true,
      },
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('tipo_maturity_inconsistente: MATURITY deve gerar isIncoming=true')
    expect(result.errors).toContain('entrada_saida_inconsistente: entrada deve gerar isIncoming=true')
  })

  it('bloqueia quando asset class nao existe', () => {
    const result = validateTransactionConsistency(
      {
        ...baseSample,
        assetClass: null,
      },
      {
        type: 'BUY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'compra',
        isIncoming: false,
        isTaxExempt: false,
      },
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('asset_class_ausente: Asset class nao identificada — bloquear ingestao')
  })
})
