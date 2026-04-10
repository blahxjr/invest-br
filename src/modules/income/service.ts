import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { IncomeEventCreateInput, RentalReceiptCreateInput, AssetPosition } from './types'

type Decimal = Prisma.Decimal

// ── Income Events ─────────────────────────────────────────────────────────────

export async function createIncomeEvent(input: IncomeEventCreateInput) {
  return prisma.incomeEvent.create({
    data: {
      type: input.type,
      accountId: input.accountId,
      assetId: input.assetId ?? null,
      transactionId: input.transactionId ?? null,
      grossAmount: new Prisma.Decimal(input.grossAmount.toString()),
      taxAmount: input.taxAmount != null ? new Prisma.Decimal(input.taxAmount.toString()) : null,
      netAmount: new Prisma.Decimal(input.netAmount.toString()),
      paymentDate: input.paymentDate,
      notes: input.notes ?? null,
    },
    include: { asset: true, account: true },
  })
}

export async function getIncomeEventsByAccount(accountId: string) {
  return prisma.incomeEvent.findMany({
    where: { accountId },
    include: { asset: true },
    orderBy: { paymentDate: 'desc' },
  })
}

export async function getTotalIncomeByAccount(accountId: string): Promise<Decimal> {
  const events = await prisma.incomeEvent.findMany({
    where: { accountId },
    select: { netAmount: true },
  })
  return events.reduce((sum, e) => sum.plus(e.netAmount), new Prisma.Decimal(0))
}

// ── Rental Receipts ───────────────────────────────────────────────────────────

export async function createRentalReceipt(input: RentalReceiptCreateInput) {
  return prisma.rentalReceipt.create({
    data: {
      propertyName: input.propertyName,
      accountId: input.accountId,
      grossRent: new Prisma.Decimal(input.grossRent.toString()),
      expenses: input.expenses != null ? new Prisma.Decimal(input.expenses.toString()) : null,
      netRent: new Prisma.Decimal(input.netRent.toString()),
      paymentDate: input.paymentDate,
    },
    include: { account: true },
  })
}

export async function getRentalReceiptsByAccount(accountId: string) {
  return prisma.rentalReceipt.findMany({
    where: { accountId },
    orderBy: { paymentDate: 'desc' },
  })
}

// ── Cálculo de Posição ────────────────────────────────────────────────────────

/**
 * Calcula a posição atual de um ativo em uma conta.
 *
 * Agrega todas as transações BUY e SELL do par (accountId, assetId),
 * calculando quantidade líquida e custo médio ponderado.
 *
 * Custo médio ponderado:
 *   - A cada BUY: novo_custo_medio = (qty_anterior × custo_anterior + qty_nova × price_nova)
 *                                     / (qty_anterior + qty_nova)
 *   - A cada SELL: mantém o custo médio, reduz a quantidade.
 */
export async function calculatePositionByAsset(
  accountId: string,
  assetId: string,
): Promise<AssetPosition | null> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset) return null

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      assetId,
      type: { in: ['BUY', 'SELL'] },
    },
    orderBy: { date: 'asc' },
    select: { type: true, quantity: true, price: true, totalAmount: true },
  })

  let quantity = new Prisma.Decimal(0)
  let averageCost = new Prisma.Decimal(0)
  let totalCost = new Prisma.Decimal(0)
  let buyCount = 0
  let sellCount = 0

  for (const tx of transactions) {
    const qty = tx.quantity ?? new Prisma.Decimal(0)
    const price = tx.price ?? (qty.isZero() ? new Prisma.Decimal(0) : new Prisma.Decimal(tx.totalAmount).div(qty))

    if (tx.type === 'BUY') {
      // Custo médio ponderado
      const newTotalCost = totalCost.plus(qty.times(price))
      const newQuantity = quantity.plus(qty)
      averageCost = newQuantity.isZero() ? new Prisma.Decimal(0) : newTotalCost.div(newQuantity)
      quantity = newQuantity
      totalCost = newTotalCost
      buyCount++
    } else if (tx.type === 'SELL') {
      quantity = quantity.minus(qty)
      totalCost = quantity.isZero() ? new Prisma.Decimal(0) : averageCost.times(quantity)
      sellCount++
    }
  }

  return {
    assetId,
    ticker: asset.ticker,
    name: asset.name,
    quantity,
    averageCost,
    totalCost,
    buyCount,
    sellCount,
  }
}

/**
 * Retorna todas as posições abertas (qty > 0) de uma conta.
 */
export async function getPositionsByAccount(accountId: string): Promise<AssetPosition[]> {
  // Agrega assetIds únicos com BUY/SELL nesta conta
  const assetIds = await prisma.transaction.findMany({
    where: { accountId, type: { in: ['BUY', 'SELL'] }, assetId: { not: null } },
    select: { assetId: true },
    distinct: ['assetId'],
  })

  const positions = await Promise.all(
    assetIds.map(({ assetId }) => calculatePositionByAsset(accountId, assetId!)),
  )

  return positions.filter((p): p is AssetPosition => p !== null && p.quantity.greaterThan(0))
}
