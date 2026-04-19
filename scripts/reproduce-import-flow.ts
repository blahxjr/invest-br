#!/usr/bin/env tsx
/**
 * Script de reprodução end-to-end do fluxo de importação B3.
 *
 * Etapas:
 *  1. Movimentação  — parse de planilha mock → analyzeMovimentacaoRows → confirmAndImportMovimentacaoForUser
 *  2. Posição       — parse de planilha mock → analyzePosicaoRows → confirmAndImportPosicaoForUser
 *  3. Dashboard     — getPortfolioSummary → valida interligação posição/transação
 *
 * Uso: pnpm tsx scripts/reproduce-import-flow.ts [--keep]
 *   --keep  : não apaga os dados criados ao final (útil para inspeção no Studio)
 */

// Carrega variáveis de ambiente antes de qualquer import que precise do banco
import { config } from 'dotenv'
config({ path: '.env.local', override: true })
config({ path: '.env' })

import { prisma } from '@/lib/prisma'
import {
  analyzeMovimentacaoRows,
  analyzePosicaoRows,
  confirmAndImportMovimentacaoForUser,
  confirmAndImportPosicaoForUser,
} from '@/modules/b3/service'
import { parseMovimentacaoForReview, parsePosicaoForReview } from '@/modules/b3/parser'
import { getPortfolioSummary } from '@/modules/positions/service'

const KEEP_DATA = process.argv.includes('--keep')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(label: string, value: unknown) {
  console.log(`\n[${label}]`, JSON.stringify(value, null, 2))
}

function ok(msg: string) {
  console.log(`  ✅ ${msg}`)
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`)
  process.exitCode = 1
}

// ─── Dados mock — planilha de Movimentação (formato B3) ──────────────────────

const MOV_ROWS = [
  ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
  // Compra de ação
  ['Debito', '10/03/2026', 'Transferência - Liquidação', 'PETR4 - PETROBRAS PN', 'XP INVESTIMENTOS CCTVM S/A', '100', '38.50', '3850.00'],
  // Compra de FII
  ['Debito', '12/03/2026', 'Transferência - Liquidação', 'HGLG11 - CSHG LOGÍSTICA FII', 'XP INVESTIMENTOS CCTVM S/A', '30', '165.00', '4950.00'],
  // Dividendo isento (FII)
  ['Credito', '15/04/2026', 'Rendimento', 'HGLG11 - CSHG LOGÍSTICA FII', 'XP INVESTIMENTOS CCTVM S/A', '0', '-', '120.00'],
  // Dividendo de ação
  ['Credito', '10/04/2026', 'Dividendo', 'PETR4 - PETROBRAS PN', 'XP INVESTIMENTOS CCTVM S/A', '0', '-', '85.00'],
  // Linha inválida (sem instituição) — deve ser SKIP
  ['Credito', '01/04/2026', 'Rendimento', 'VALE3 - VALE', '', '0', '-', '50.00'],
]

// ─── Dados mock — planilha de Posição (formato B3, multi-sheet) ──────────────

const POS_SHEETS = [
  {
    name: 'Acoes',
    rows: [
      ['Produto', 'Instituição', 'Conta', 'Código de Negociação', '', '', 'Tipo', '', 'Quantidade', '', '', '', 'Preço de fechamento', 'Valor atualizado'],
      ['PETR4 - PETROBRAS PN', 'XP INVESTIMENTOS CCTVM S/A', 'Conta 1', 'PETR4', '', '', 'PN', '', '100', '', '', '', '39.20', '3920.00'],
      ['VALE3 - VALE ON', 'XP INVESTIMENTOS CCTVM S/A', 'Conta 1', 'VALE3', '', '', 'ON', '', '50', '', '', '', '68.50', '3425.00'],
    ],
  },
  {
    name: 'Fundo Imobiliário',
    rows: [
      ['Produto', 'Instituição', 'Conta', 'Código de Negociação', '', '', 'Tipo', '', 'Quantidade', '', '', '', 'Preço de fechamento', 'Valor atualizado'],
      ['HGLG11 - CSHG LOGÍSTICA FII', 'XP INVESTIMENTOS CCTVM S/A', 'Conta 1', 'HGLG11', '', '', 'CI', '', '30', '', '', '', '168.00', '5040.00'],
    ],
  },
]

// ─── Usuário de teste ─────────────────────────────────────────────────────────

let testUserId: string

async function setupUser() {
  const user = await prisma.user.create({
    data: {
      email: `reproduce-import-${Date.now()}@invest.br`,
      name: 'Reproduce Import Flow',
    },
  })
  testUserId = user.id
  console.log(`\n👤 Usuário de teste: ${user.email} (id=${user.id})`)

  // AssetClasses mínimas
  for (const c of [
    { code: 'ACOES', name: 'Ações' },
    { code: 'FII', name: 'Fundos Imobiliários' },
  ]) {
    await prisma.assetClass.upsert({ where: { code: c.code }, update: {}, create: c })
  }
}

// ─── Etapa 1: Movimentação ────────────────────────────────────────────────────

async function runMovimentacao(): Promise<boolean> {
  console.log('\n━━━ ETAPA 1: MOVIMENTAÇÃO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const parsed = parseMovimentacaoForReview(MOV_ROWS)
  console.log(`  Linhas parseadas: ${parsed.length}`)

  const analysis = await analyzeMovimentacaoRows(parsed)
  log('analyze.summary', analysis.summary)

  if (analysis.summary.totalRows !== 5) {
    fail(`Esperado 5 linhas totais, obtido ${analysis.summary.totalRows}`)
    return false
  }
  ok(`totalRows=${analysis.summary.totalRows}`)

  const result = await confirmAndImportMovimentacaoForUser(testUserId, analysis.lines)
  log('confirm.result', result)

  // 4 linhas válidas (1 SKIP por instituição ausente)
  if (result.imported < 3) {
    fail(`Esperado ≥3 importadas, obtido ${result.imported}`)
    return false
  }
  ok(`imported=${result.imported}, skipped=${result.skipped}`)

  if (result.errors.length > 0) {
    console.log('  ⚠️  Erros durante importação:', result.errors)
  }

  // Verifica AuditLog
  const auditLog = await prisma.auditLog.findFirst({
    where: { changedBy: testUserId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    orderBy: { changedAt: 'desc' },
  })
  if (!auditLog) {
    fail('AuditLog de movimentação NÃO encontrado no banco')
    return false
  }
  ok(`AuditLog gravado (id=${auditLog.id})`)

  // Verifica Transactions criadas
  const client = await prisma.client.findFirst({ where: { userId: testUserId } })
  if (!client) { fail('Client não criado'); return false }

  const accounts = await prisma.account.findMany({ where: { clientId: client.id } })
  const accountIds = accounts.map((a) => a.id)
  const txCount = await prisma.transaction.count({ where: { accountId: { in: accountIds } } })
  ok(`Transactions no banco: ${txCount}`)

  if (txCount < 1) {
    fail('Nenhuma Transaction foi criada')
    return false
  }

  return true
}

// ─── Etapa 2: Posição ─────────────────────────────────────────────────────────

async function runPosicao(): Promise<boolean> {
  console.log('\n━━━ ETAPA 2: POSIÇÃO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const parsed = parsePosicaoForReview(POS_SHEETS)
  console.log(`  Linhas parseadas: ${parsed.length}`)

  const analysis = await analyzePosicaoRows(parsed)
  log('analyze.summary', analysis.summary)

  const result = await confirmAndImportPosicaoForUser(testUserId, analysis.lines)
  log('confirm.result', result)

  if ((result.upserted ?? 0) < 1) {
    fail(`Esperado ≥1 upserted, obtido ${result.upserted}`)
    return false
  }
  ok(`upserted=${result.upserted}, skipped=${result.skipped}`)

  // Verifica AuditLog de posição
  const auditLog = await prisma.auditLog.findFirst({
    where: { changedBy: testUserId, entityType: 'IMPORT_B3_POSICAO' },
    orderBy: { changedAt: 'desc' },
  })
  if (!auditLog) {
    fail('AuditLog de posição NÃO encontrado')
    return false
  }
  ok(`AuditLog posição gravado (id=${auditLog.id})`)

  return true
}

// ─── Etapa 3: Dashboard ───────────────────────────────────────────────────────

async function runDashboard(): Promise<boolean> {
  console.log('\n━━━ ETAPA 3: DASHBOARD / PORTFOLIO SUMMARY ━━━━━━━━━━━━━━━━━━━━')

  const summary = await getPortfolioSummary(testUserId)
  log('portfolioSummary', {
    totalCost: summary.totalCost.toString(),
    totalValue: summary.totalValue.toString(),
    totalGainLoss: summary.totalGainLoss.toString(),
    totalGainLossPct: summary.totalGainLossPct,
    assetCount: summary.assetCount,
    monthlyIncome: summary.monthlyIncome.toString(),
    topPositions: summary.topPositions.map((p) => ({ ticker: p.ticker, qty: p.quantity })),
    allocationByClass: summary.allocationByClass.map((a) => ({ class: a.className ?? a.assetClassCode, pct: a.allocationPct })),
  })

  if (summary.assetCount < 1) {
    fail('Dashboard retornou assetCount=0 — interligação posição↔transação quebrada')
    return false
  }
  ok(`assetCount=${summary.assetCount}`)

  if (Number(summary.totalCost.toString()) <= 0) {
    fail('totalCost=0 — positions não estão calculando custo médio')
    return false
  }
  ok(`totalCost=${summary.totalCost}`)

  if (summary.topPositions.length === 0) {
    fail('topPositions vazia — dashboard não está listando posições')
    return false
  }
  ok(`topPositions[0].ticker=${summary.topPositions[0]?.ticker}`)

  return true
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (KEEP_DATA) {
    console.log('\n⚠️  --keep ativo: dados de teste preservados no banco.')
    return
  }

  console.log('\n🧹 Limpando dados de teste...')

  try {
    const client = await prisma.client.findFirst({ where: { userId: testUserId } })
    const accountIds = client
      ? (await prisma.account.findMany({ where: { clientId: client.id }, select: { id: true } })).map((a) => a.id)
      : []

    await prisma.auditLog.deleteMany({ where: { changedBy: testUserId } })

    if (accountIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({ where: { accountId: { in: accountIds } } })
      await prisma.transaction.deleteMany({ where: { accountId: { in: accountIds } } })
      await prisma.account.deleteMany({ where: { id: { in: accountIds } } })
    }

    if (client) await prisma.client.delete({ where: { id: client.id } })
    await prisma.user.delete({ where: { id: testUserId } })
    console.log('  ✅ Dados removidos.')
  } catch (e) {
    console.warn('  ⚠️  Falha parcial na limpeza:', e)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  REPRODUÇÃO END-TO-END: Importação B3 + Dashboard')
  console.log('  Data:', new Date().toLocaleString('pt-BR'))
  console.log('═══════════════════════════════════════════════════════════════')

  try {
    await setupUser()

    const step1 = await runMovimentacao()
    const step2 = step1 ? await runPosicao() : false
    const step3 = step2 ? await runDashboard() : false

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('  RESULTADO FINAL')
    console.log(`  Etapa 1 - Movimentação : ${step1 ? '✅ OK' : '❌ FALHOU'}`)
    console.log(`  Etapa 2 - Posição      : ${step2 ? '✅ OK' : '❌ FALHOU (ou bloqueado por etapa 1)'}`)
    console.log(`  Etapa 3 - Dashboard    : ${step3 ? '✅ OK' : '❌ FALHOU (ou bloqueado por etapa 2)'}`)
    console.log('═══════════════════════════════════════════════════════════════')
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('\n💥 Erro fatal:', err)
  process.exit(1)
})
