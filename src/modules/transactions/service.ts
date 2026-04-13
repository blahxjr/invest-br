import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { TransactionCreateInput, TransactionResult } from './types'

type Decimal = Prisma.Decimal

/**
 * Calcula o saldo atual da conta somando créditos e débitos dos LedgerEntries.
 * Retorna 0 se não houver entradas.
 */
async function getCurrentBalance(accountId: string, tx: typeof prisma): Promise<Decimal> {
  const last = await tx.ledgerEntry.findFirst({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  })
  return last?.balanceAfter ?? new Prisma.Decimal(0)
}

/**
 * Cria uma transação financeira de forma idempotente e registra as entradas
 * no ledger atomicamente.
 *
 * Idempotência: se `referenceId` já existir, retorna a transação existente
 * com `idempotent: true` sem criar duplicatas.
 *
 * Regra de ledger:
 *  - BUY / WITHDRAWAL: débito na conta (saída de caixa)
 *  - SELL / DEPOSIT / DIVIDEND / INCOME / RENT: crédito na conta (entrada de caixa)
 */
export async function createTransaction(input: TransactionCreateInput): Promise<TransactionResult> {
  // ── Verificação de idempotência ─────────────────────────────────────────────
  const existing = await prisma.transaction.findUnique({
    where: { referenceId: input.referenceId },
    include: { ledgerEntries: true },
  })

  if (existing) {
    return { ...existing, idempotent: true }
  }

  const totalAmount = new Prisma.Decimal(input.totalAmount.toString())
  const DEBIT_TYPES = ['BUY', 'WITHDRAWAL']
  const isDebit = DEBIT_TYPES.includes(input.type)

  // ── Execução atômica: Transaction + LedgerEntry ─────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const currentBalance = await getCurrentBalance(input.accountId, tx as typeof prisma)

    const balanceAfter = isDebit
      ? currentBalance.minus(totalAmount)
      : currentBalance.plus(totalAmount)

    const transaction = await tx.transaction.create({
      data: {
        referenceId: input.referenceId,
        type: input.type,
        accountId: input.accountId,
        assetId: input.assetId ?? null,
        quantity: input.quantity != null ? new Prisma.Decimal(input.quantity.toString()) : null,
        price: input.price != null ? new Prisma.Decimal(input.price.toString()) : null,
        totalAmount,
        date: input.date,
        notes: input.notes ?? null,
      },
    })

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: input.accountId,
        debit: isDebit ? totalAmount : null,
        credit: isDebit ? null : totalAmount,
        balanceAfter,
      },
    })

    return { transaction, ledgerEntry }
  })

  return {
    ...result.transaction,
    ledgerEntries: [result.ledgerEntry],
    idempotent: false,
  }
}

/**
 * Retorna todas as transações de uma conta, ordenadas por data descendente.
 */
export async function getTransactionsByAccount(accountId: string) {
  return prisma.transaction.findMany({
    where: { accountId },
    include: {
      asset: true,
      ledgerEntries: true,
    },
    orderBy: { date: 'desc' },
  })
}

/**
 * Retorna o saldo atual de uma conta (último balanceAfter do ledger).
 */
export async function getAccountBalance(accountId: string): Promise<Decimal> {
  return getCurrentBalance(accountId, prisma)
}

/**
 * Retorna uma transação pelo referenceId (útil para debug e auditoria).
 */
export async function getTransactionByReference(referenceId: string) {
  return prisma.transaction.findUnique({
    where: { referenceId },
    include: { asset: true, ledgerEntries: true },
  })
}
