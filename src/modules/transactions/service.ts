import { Prisma, type LedgerAccount, type Transaction, type TransactionType } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { TransactionCreateInput, TransactionResult } from './types'

type Decimal = Prisma.Decimal

const NON_FINANCIAL_TYPES: TransactionType[] = [
  'CUSTODY_TRANSFER',
  'SUBSCRIPTION_RIGHT',
  'CORPORATE_UPDATE',
  'SPLIT',
  'BONUS_SHARES',
]

const DEFAULT_DEBIT_TYPES: TransactionType[] = ['BUY', 'WITHDRAWAL']

const LEDGER_ACCOUNT_CODES = {
  CASH: 'ASSET_CASH',
  INVESTMENTS: 'ASSET_INVESTMENTS',
  INCOME_FII: 'INCOME_FII_RENTS',
  INCOME_DIVIDENDS: 'INCOME_DIVIDENDS',
  INCOME_INTEREST: 'INCOME_INTEREST',
  EQUITY_CAPITAL: 'EQUITY_CAPITAL_CONTRIBUTIONS',
  EXPENSE_WITHDRAWALS: 'EXPENSE_WITHDRAWALS',
} as const

type LedgerAccountCode = (typeof LEDGER_ACCOUNT_CODES)[keyof typeof LEDGER_ACCOUNT_CODES]

type LedgerEntryDraft = {
  accountId: string
  ledgerAccountId: string
  debit: Decimal | null
  credit: Decimal | null
  movementType: string
  description: string | null
  isIncoming: boolean
  balanceAfter: Decimal
}

type AccountStatementLine = {
  date: Date
  description: string
  debit: Decimal | null
  credit: Decimal | null
  runningBalance: Decimal
}

function pickIncomeLedgerCode(input: TransactionCreateInput): LedgerAccountCode {
  const source = (input.sourceMovementType ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (input.type === 'DIVIDEND') return LEDGER_ACCOUNT_CODES.INCOME_DIVIDENDS
  if (source.includes('juro')) return LEDGER_ACCOUNT_CODES.INCOME_INTEREST
  if (source.includes('rendimento')) return LEDGER_ACCOUNT_CODES.INCOME_FII
  return LEDGER_ACCOUNT_CODES.INCOME_DIVIDENDS
}

function shouldSkipFinancialLedger(type: TransactionCreateInput['type'], totalAmount: Decimal): boolean {
  return NON_FINANCIAL_TYPES.includes(type) || totalAmount.eq(0)
}

function resolveIncomingDirection(input: TransactionCreateInput): boolean {
  if (typeof input.isIncoming === 'boolean') return input.isIncoming
  return !DEFAULT_DEBIT_TYPES.includes(input.type)
}

function sumDebits(entries: LedgerEntryDraft[]): Decimal {
  return entries.reduce((acc, entry) => acc.plus(entry.debit ?? 0), new Prisma.Decimal(0))
}

function sumCredits(entries: LedgerEntryDraft[]): Decimal {
  return entries.reduce((acc, entry) => acc.plus(entry.credit ?? 0), new Prisma.Decimal(0))
}

/**
 * Garante que os lançamentos estão em partidas dobradas (débito = crédito).
 */
export function validateDoubleEntry(entries: LedgerEntryDraft[]): void {
  const totalDebits = sumDebits(entries)
  const totalCredits = sumCredits(entries)
  if (!totalDebits.eq(totalCredits)) {
    throw new Error(`Double-entry inválido: debitos=${totalDebits.toString()} creditos=${totalCredits.toString()}`)
  }
}

/**
 * Garante o plano de contas mínimo exigido para o ledger contábil.
 */
async function ensureLedgerChart(tx: typeof prisma): Promise<Record<LedgerAccountCode, LedgerAccount>> {
  const requiredAccounts: Array<{ code: LedgerAccountCode; name: string; type: LedgerAccount['type'] }> = [
    { code: LEDGER_ACCOUNT_CODES.CASH, name: 'Caixa', type: 'ASSET' },
    { code: LEDGER_ACCOUNT_CODES.INVESTMENTS, name: 'Investimentos', type: 'ASSET' },
    { code: LEDGER_ACCOUNT_CODES.INCOME_FII, name: 'Rendimentos FII', type: 'INCOME' },
    { code: LEDGER_ACCOUNT_CODES.INCOME_DIVIDENDS, name: 'Dividendos', type: 'INCOME' },
    { code: LEDGER_ACCOUNT_CODES.INCOME_INTEREST, name: 'Juros', type: 'INCOME' },
    { code: LEDGER_ACCOUNT_CODES.EQUITY_CAPITAL, name: 'Aportes de Capital', type: 'EQUITY' },
    { code: LEDGER_ACCOUNT_CODES.EXPENSE_WITHDRAWALS, name: 'Saques', type: 'EXPENSE' },
  ]

  const upserts = await Promise.all(
    requiredAccounts.map((account) =>
      tx.ledgerAccount.upsert({
        where: { code: account.code },
        update: { name: account.name, type: account.type, isActive: true },
        create: { code: account.code, name: account.name, type: account.type, isActive: true },
      }),
    ),
  )

  return upserts.reduce<Record<LedgerAccountCode, LedgerAccount>>((acc, account) => {
    acc[account.code as LedgerAccountCode] = account
    return acc
  }, {} as Record<LedgerAccountCode, LedgerAccount>)
}

/**
 * Gera os lançamentos de partidas dobradas por transação.
 */
export function createLedgerEntries(input: {
  transaction: Pick<Transaction, 'id' | 'accountId' | 'type' | 'totalAmount' | 'notes' | 'sourceMovementType'>
  ledgerAccounts: Record<LedgerAccountCode, LedgerAccount>
  currentBalance: Decimal
  isIncoming: boolean
}): LedgerEntryDraft[] {
  const { transaction, ledgerAccounts, currentBalance, isIncoming } = input
  const amount = transaction.totalAmount
  const description = transaction.notes ?? null

  const cashDeltaByType: Partial<Record<TransactionType, Decimal>> = {
    BUY: amount.neg(),
    SELL: amount,
    INCOME: amount,
    DIVIDEND: amount,
    RENT: amount,
    MATURITY: amount,
    DEPOSIT: amount,
    WITHDRAWAL: amount.neg(),
  }

  const cashDelta = cashDeltaByType[transaction.type] ?? new Prisma.Decimal(0)
  const nextBalance = currentBalance.plus(cashDelta)

  if (transaction.type === 'BUY') {
    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.INVESTMENTS].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  if (transaction.type === 'SELL') {
    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.INVESTMENTS].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  if (transaction.type === 'INCOME' || transaction.type === 'DIVIDEND' || transaction.type === 'RENT') {
    const incomeCode = pickIncomeLedgerCode({
      referenceId: '',
      type: transaction.type,
      accountId: transaction.accountId,
      totalAmount: amount.toString(),
      date: new Date(),
      sourceMovementType: transaction.sourceMovementType ?? undefined,
    })

    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[incomeCode].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  if (transaction.type === 'MATURITY') {
    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.INVESTMENTS].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  if (transaction.type === 'DEPOSIT') {
    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.EQUITY_CAPITAL].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  if (transaction.type === 'WITHDRAWAL') {
    return [
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.EXPENSE_WITHDRAWALS].id,
        debit: amount,
        credit: null,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
      {
        accountId: transaction.accountId,
        ledgerAccountId: ledgerAccounts[LEDGER_ACCOUNT_CODES.CASH].id,
        debit: null,
        credit: amount,
        movementType: transaction.sourceMovementType ?? transaction.type,
        description,
        isIncoming,
        balanceAfter: nextBalance,
      },
    ]
  }

  return []
}

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
  const isIncoming = resolveIncomingDirection(input)
  const shouldSkipLedger = shouldSkipFinancialLedger(input.type, totalAmount)

  // ── Plano de contas (fora da transação — dado de referência, não transacional) ──
  const ledgerAccounts = shouldSkipLedger ? null : await ensureLedgerChart(prisma)

  // ── Execução atômica: Transaction + LedgerEntry ─────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const currentBalance = await getCurrentBalance(input.accountId, tx as typeof prisma)

    const transaction = await tx.transaction.create({
      data: {
        referenceId: input.referenceId,
        type: input.type,
        accountId: input.accountId,
        originAccountId: input.originAccountId ?? null,
        assetId: input.assetId ?? null,
        quantity: input.quantity != null ? new Prisma.Decimal(input.quantity.toString()) : null,
        price: input.price != null ? new Prisma.Decimal(input.price.toString()) : null,
        totalAmount,
        date: input.date,
        sourceMovementType: input.sourceMovementType ?? null,
        isTaxExempt: input.isTaxExempt ?? false,
        subscriptionDeadline: input.subscriptionDeadline ?? null,
        notes: input.notes ?? null,
      },
    })

    if (shouldSkipLedger) {
      return { transaction, ledgerEntries: [] as Awaited<ReturnType<typeof tx.ledgerEntry.create>>[] }
    }

    const entryDrafts = createLedgerEntries({
      transaction: {
        id: transaction.id,
        accountId: transaction.accountId,
        type: transaction.type,
        totalAmount: transaction.totalAmount,
        notes: input.ledgerDescription ?? transaction.notes,
        sourceMovementType: input.ledgerMovementType ?? transaction.sourceMovementType,
      },
      ledgerAccounts: ledgerAccounts!,
      currentBalance,
      isIncoming,
    })

    validateDoubleEntry(entryDrafts)

    const createdLedgerEntries: Awaited<ReturnType<typeof tx.ledgerEntry.create>>[] = []
    for (const draft of entryDrafts) {
      const created = await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: draft.accountId,
          ledgerAccountId: draft.ledgerAccountId,
          debit: draft.debit,
          credit: draft.credit,
          movementType: draft.movementType,
          description: draft.description,
          isIncoming: draft.isIncoming,
          balanceAfter: draft.balanceAfter,
        },
      })
      createdLedgerEntries.push(created)
    }

    return { transaction, ledgerEntries: createdLedgerEntries }
  })

  return {
    ...result.transaction,
    ledgerEntries: result.ledgerEntries,
    idempotent: false,
  }
}

/**
 * Retorna todas as transações de uma conta, ordenadas por data descendente.
 * Exclui transações soft-deleted (deletedAt IS NOT NULL).
 */
export async function getTransactionsByAccount(accountId: string) {
  return prisma.transaction.findMany({
    where: { 
      accountId,
      deletedAt: null,
    },
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
 * Retorna o extrato da conta com saldo acumulado por movimentação de caixa.
 */
export async function getAccountStatement(accountId: string): Promise<AccountStatementLine[]> {
  const cashAccount = await prisma.ledgerAccount.findUnique({
    where: { code: LEDGER_ACCOUNT_CODES.CASH },
    select: { id: true },
  })

  if (!cashAccount) return []

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      accountId,
      ledgerAccountId: cashAccount.id,
      transaction: {
        deletedAt: null,
      },
    },
    include: {
      transaction: {
        select: { date: true, notes: true, type: true, sourceMovementType: true },
      },
    },
    orderBy: [{ transaction: { date: 'asc' } }, { createdAt: 'asc' }],
  })

  let runningBalance = new Prisma.Decimal(0)
  return rows.map((entry) => {
    const debit = entry.debit ?? null
    const credit = entry.credit ?? null
    runningBalance = runningBalance.plus(debit ?? 0).minus(credit ?? 0)

    return {
      date: entry.transaction.date,
      description: entry.description ?? entry.transaction.notes ?? entry.transaction.sourceMovementType ?? entry.transaction.type,
      debit,
      credit,
      runningBalance,
    }
  })
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
