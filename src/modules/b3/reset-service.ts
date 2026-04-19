import { prisma } from '@/lib/prisma'

export type ResetImportDataResult = {
  auditLogsDeleted: number
  ledgerEntriesDeleted: number
  incomeEventsDeleted: number
  rentalReceiptsDeleted: number
  transactionsDeleted: number
  accountsDeleted: number
  institutionsDeleted: number
  assetsDeleted: number
  assetClassesDeleted: number
}

/**
 * Limpa os dados transacionais e cadastrais gerados para testes de importacao B3.
 * Preserva usuarios, clientes e carteiras para que o sistema continue acessivel apos o reset.
 */
export async function resetImportData(): Promise<ResetImportDataResult> {
  const auditLogsDeleted = await prisma.auditLog.deleteMany({}).then((result) => result.count)
  const ledgerEntriesDeleted = await prisma.ledgerEntry.deleteMany({}).then((result) => result.count)
  const incomeEventsDeleted = await prisma.incomeEvent.deleteMany({}).then((result) => result.count)
  const rentalReceiptsDeleted = await prisma.rentalReceipt.deleteMany({}).then((result) => result.count)
  const transactionsDeleted = await prisma.transaction.deleteMany({}).then((result) => result.count)
  const accountsDeleted = await prisma.account.deleteMany({}).then((result) => result.count)
  const institutionsDeleted = await prisma.institution.deleteMany({}).then((result) => result.count)

  const assetsDeleted = await prisma.asset.deleteMany({
    where: { ticker: { not: null } },
  }).then((result) => result.count)

  // AssetClasses são dados de catálogo/referência e NÃO devem ser deletados no reset.
  // Deletá-las causaria falha em todas as importações subsequentes.
  const assetClassesDeleted = 0

  return {
    auditLogsDeleted,
    ledgerEntriesDeleted,
    incomeEventsDeleted,
    rentalReceiptsDeleted,
    transactionsDeleted,
    accountsDeleted,
    institutionsDeleted,
    assetsDeleted,
    assetClassesDeleted,
  }
}