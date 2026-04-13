import { config } from 'dotenv'
config({ path: '.env.local', override: true })
config({ path: '.env' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Iniciando seed do catálogo de ativos...')

  // ── Classes de ativos ──────────────────────────────────────────────────────
  const classes = await Promise.all([
    prisma.assetClass.upsert({
      where: { code: 'ACOES' },
      update: {},
      create: { name: 'Ações', code: 'ACOES', description: 'Ações de empresas listadas em bolsa (B3)' },
    }),
    prisma.assetClass.upsert({
      where: { code: 'FII' },
      update: {},
      create: { name: 'Fundos Imobiliários', code: 'FII', description: 'FIIs negociados na B3' },
    }),
    prisma.assetClass.upsert({
      where: { code: 'ETF' },
      update: {},
      create: { name: 'ETFs', code: 'ETF', description: 'Exchange Traded Funds listados na B3' },
    }),
    prisma.assetClass.upsert({
      where: { code: 'RF' },
      update: {},
      create: { name: 'Renda Fixa', code: 'RF', description: 'Tesouro Direto, CDB, LCI, LCA, CRI, CRA, Debentures' },
    }),
    prisma.assetClass.upsert({
      where: { code: 'CRYPTO' },
      update: {},
      create: { name: 'Criptomoedas', code: 'CRYPTO', description: 'Ativos digitais e criptomoedas' },
    }),
    prisma.assetClass.upsert({
      where: { code: 'CASH' },
      update: {},
      create: { name: 'Caixa e Equivalentes', code: 'CASH', description: 'Conta corrente, poupança, CDB liquidez diária' },
    }),
  ])

  const [acoes, fii, etf] = classes
  console.log(`✅ ${classes.length} classes de ativos criadas/confirmadas`)

  // ── Ações BR ───────────────────────────────────────────────────────────────
  const stocks = [
    { name: 'Petrobras PN', ticker: 'PETR4', category: 'STOCK' as const },
    { name: 'Petrobras ON', ticker: 'PETR3', category: 'STOCK' as const },
    { name: 'Itaú Unibanco PN', ticker: 'ITUB4', category: 'STOCK' as const },
    { name: 'Vale ON', ticker: 'VALE3', category: 'STOCK' as const },
    { name: 'Bradesco PN', ticker: 'BBDC4', category: 'STOCK' as const },
    { name: 'Ambev ON', ticker: 'ABEV3', category: 'STOCK' as const },
    { name: 'WEG ON', ticker: 'WEGE3', category: 'STOCK' as const },
    { name: 'Magazine Luiza ON', ticker: 'MGLU3', category: 'STOCK' as const },
  ]

  for (const s of stocks) {
    await prisma.asset.upsert({
      where: { ticker: s.ticker },
      update: {},
      create: { name: s.name, ticker: s.ticker, category: s.category, assetClassId: acoes.id },
    })
  }
  console.log(`✅ ${stocks.length} ações cadastradas`)

  // ── FIIs ───────────────────────────────────────────────────────────────────
  const fiis = [
    { name: 'IFIX11 FII', ticker: 'IFIX11', category: 'FII' as const },
    { name: 'HGLG11 - CSHG Logística', ticker: 'HGLG11', category: 'FII' as const },
    { name: 'KNRI11 - Kinea Renda Imobiliária', ticker: 'KNRI11', category: 'FII' as const },
    { name: 'XPML11 - XP Malls', ticker: 'XPML11', category: 'FII' as const },
  ]

  for (const f of fiis) {
    await prisma.asset.upsert({
      where: { ticker: f.ticker },
      update: {},
      create: { name: f.name, ticker: f.ticker, category: f.category, assetClassId: fii.id },
    })
  }
  console.log(`✅ ${fiis.length} FIIs cadastrados`)

  // ── ETFs ───────────────────────────────────────────────────────────────────
  const etfs = [
    { name: 'BOVA11 - iShares Ibovespa', ticker: 'BOVA11', category: 'ETF' as const },
    { name: 'SMAL11 - iShares Small Cap', ticker: 'SMAL11', category: 'ETF' as const },
    { name: 'IVVB11 - iShares S&P 500', ticker: 'IVVB11', category: 'ETF' as const },
  ]

  for (const e of etfs) {
    await prisma.asset.upsert({
      where: { ticker: e.ticker },
      update: {},
      create: { name: e.name, ticker: e.ticker, category: e.category, assetClassId: etf.id },
    })
  }
  console.log(`✅ ${etfs.length} ETFs cadastrados`)

  // Evita criar múltiplas instâncias de client Decimal e mantém seed idempotente
  const defaultInsightTypes = [
    {
      code: 'CONCENTRACAO_ATIVO',
      label: 'Concentração por ativo',
      description: 'Alerta quando um único ativo ultrapassa o limite configurado.',
      defaultThreshold: '0.2500',
    },
    {
      code: 'CONCENTRACAO_CLASSE',
      label: 'Concentração por classe',
      description: 'Alerta quando uma classe de ativos ultrapassa o limite configurado.',
      defaultThreshold: '0.5000',
    },
    {
      code: 'CONCENTRACAO_MOEDA_PAIS',
      label: 'Concentração por moeda/país',
      description: 'Alerta quando moeda ou país ultrapassa o limite configurado.',
      defaultThreshold: '0.7000',
    },
    {
      code: 'HORIZONTE_DESALINHADO',
      label: 'Horizonte desalinhado',
      description: 'Alerta quando o horizonte dos ativos diverge do objetivo da carteira.',
      defaultThreshold: '0.3000',
    },
  ] as const

  for (const insightType of defaultInsightTypes) {
    await prisma.insightType.upsert({
      where: { code: insightType.code },
      update: {
        label: insightType.label,
        description: insightType.description,
        defaultThreshold: insightType.defaultThreshold,
        defaultSeverity: 'WARNING',
        isActive: true,
      },
      create: {
        code: insightType.code,
        label: insightType.label,
        description: insightType.description,
        defaultThreshold: insightType.defaultThreshold,
        defaultSeverity: 'WARNING',
        isActive: true,
      },
    })
  }

  const globalProfile = await prisma.insightConfigProfile.upsert({
    where: { id: 'global-insight-profile-default' },
    update: {
      name: 'Padrão Global V1',
      scope: 'GLOBAL',
      isSystemDefault: true,
      isActive: true,
    },
    create: {
      id: 'global-insight-profile-default',
      name: 'Padrão Global V1',
      description: 'Perfil global padrão para fallback dos insights na V1.',
      scope: 'GLOBAL',
      isSystemDefault: true,
      isActive: true,
    },
  })

  const allInsightTypes = await prisma.insightType.findMany({
    where: { isActive: true },
  })

  for (const insightType of allInsightTypes) {
    await prisma.insightConfigRule.upsert({
      where: {
        profileId_insightTypeId: {
          profileId: globalProfile.id,
          insightTypeId: insightType.id,
        },
      },
      update: {
        enabled: true,
        thresholdOverride: insightType.defaultThreshold,
        severityOverride: 'WARNING',
      },
      create: {
        profileId: globalProfile.id,
        insightTypeId: insightType.id,
        enabled: true,
        thresholdOverride: insightType.defaultThreshold,
        severityOverride: 'WARNING',
      },
    })
  }

  console.log(`✅ ${allInsightTypes.length} tipos de insight seedados`)

  console.log('🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
