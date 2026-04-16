#!/usr/bin/env node

import readline from 'readline'
import { resetImportData } from '@/modules/b3/reset-service'
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

function shouldSkipConfirmation() {
  return process.argv.includes('--force') || process.argv.includes('--yes')
}

async function main() {
  console.log('\n⚠️  ATENÇÃO: Esta ação apagará todos os dados de importação B3.')
  console.log('   Usuários, clientes e carteiras serão preservados.')

  if (!shouldSkipConfirmation()) {
    console.log('   Digite "CONFIRMAR" para continuar:\n')

    const answer = await prompt('Confirmação: ')

    if (answer !== 'CONFIRMAR') {
      console.log('\n❌ Operação cancelada.\n')
      rl.close()
      process.exit(0)
    }
  }

  console.log('\n🔄 Iniciando limpeza de dados...\n')

  try {
    const summary = await resetImportData()

    console.log('\n✅ Dados de importação removidos:')
    console.log(`  - ${summary.auditLogsDeleted} audit logs`)
    console.log(`  - ${summary.ledgerEntriesDeleted} lançamentos de ledger`)
    console.log(`  - ${summary.incomeEventsDeleted} eventos de renda`)
    console.log(`  - ${summary.rentalReceiptsDeleted} recebimentos de aluguel`)
    console.log(`  - ${summary.transactionsDeleted} transações`)
    console.log(`  - ${summary.accountsDeleted} contas`)
    console.log(`  - ${summary.institutionsDeleted} instituições`)
    console.log(`  - ${summary.assetsDeleted} ativos`)
    console.log(`  - ${summary.assetClassesDeleted} classes de ativos órfãs`)
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
