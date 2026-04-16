#!/usr/bin/env node

import readline from 'readline'
import { prisma } from '@/lib/prisma'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function main() {
  console.log('\n⚠️  ATENÇÃO: Esta ação apagará todos os dados de importação B3.')
  console.log('   Digite "CONFIRMAR" para continuar:\n')

  const answer = await prompt('Confirmação: ')

  if (answer !== 'CONFIRMAR') {
    console.log('\n❌ Operação cancelada.\n')
    rl.close()
    process.exit(0)
  }

  console.log('\n🔄 Iniciando limpeza de dados...\n')

  let txCount = 0
  let assetCount = 0
  let institutionCount = 0
  let accountCount = 0

  try {
    // 1. Delete AuditLog entries
    await prisma.auditLog.deleteMany({
      where: {
        entityType: {
          in: ['TRANSACTION', 'IMPORT_B3_NEGOCIACAO'],
        },
      },
    })
    console.log('✅ AuditLogs removidos')

    // 2. Delete LedgerEntry entries 
    await prisma.ledgerEntry.deleteMany({})
    console.log('✅ LedgerEntries removidas')

    // 3. Count and delete Transactions
    txCount = await prisma.transaction.count()
    await prisma.transaction.deleteMany({})
    console.log(`✅ ${txCount} transações removidas`)

    // 4. Delete all IncomeEvent entries
    const incomeCount = await prisma.incomeEvent.count()
    await prisma.incomeEvent.deleteMany({})
    console.log(`✅ ${incomeCount} eventos de renda removidos`)

    // 5. Count and delete Accounts from institutions
    accountCount = await prisma.account.count({
      where: {
        institutionId: { not: undefined },
      },
    })
    await prisma.account.deleteMany({
      where: {
        institutionId: { not: undefined },
      },
    })
    console.log(`✅ ${accountCount} contas removidas`)

    // 6. Count and delete Institutions
    institutionCount = await prisma.institution.count()
    await prisma.institution.deleteMany({})
    console.log(`✅ ${institutionCount} instituições removidas`)

    // 7. Count and delete Assets
    assetCount = await prisma.asset.count({
      where: {
        ticker: { not: null },
      },
    })
    await prisma.asset.deleteMany({
      where: {
        ticker: { not: null },
      },
    })
    console.log(`✅ ${assetCount} ativos removidos`)

    // 8. Delete AssetClasses without remaining assets
    const classesWithAssets = await prisma.assetClass.findMany({
      where: {
        assets: {
          some: {},
        },
      },
      select: { id: true },
    })

    const classesWithAssetsIds = classesWithAssets.map((c) => c.id)

    await prisma.assetClass.deleteMany({
      where: {
        id: {
          notIn: classesWithAssetsIds,
        },
      },
    })
    console.log('✅ Classes de ativos orphaned removidas')

    console.log('\n✅ Dados de importação removidos:')
    console.log(`  - ${txCount} transações`)
    console.log(`  - ${assetCount} ativos`)
    console.log(`  - ${institutionCount} instituições`)
    console.log(`  - ${accountCount} contas`)
    console.log('')
  } catch (error) {
    console.error('\n❌ Erro durante limpeza:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

main()
