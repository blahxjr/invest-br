import { AssetCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createTransaction } from '@/modules/transactions/service'
import type { MovimentacaoRow, NegociacaoRow, PosicaoRow } from './parser'

export type ImportResult = {
  imported?: number
  skipped?: number
  upserted?: number
  errors: string[]
}

type DbCategory = AssetCategory

function inferCategoryFromTickerAndMarket(ticker: string, mercado?: string): PosicaoRow['category'] {
  const upperTicker = ticker.toUpperCase()
  const lowerMarket = (mercado ?? '').toLowerCase()

  if (lowerMarket.includes('renda fixa')) return 'ETF'
  if (upperTicker.endsWith('11')) return 'FII'
  return 'STOCK'
}

function toDbCategory(category: PosicaoRow['category']): DbCategory {
  if (category === 'FII') return AssetCategory.FII
  if (category === 'ETF') return AssetCategory.ETF
  if (category === 'BDR') return AssetCategory.BDR
  return AssetCategory.STOCK
}

async function getAssetClassIdByCategory(category: PosicaoRow['category']): Promise<string> {
  const code = category === 'ETF' ? 'ETF' : category === 'FII' ? 'FII' : 'ACOES'

  const assetClass = await prisma.assetClass.findUnique({
    where: { code },
    select: { id: true },
  })

  if (!assetClass) {
    throw new Error(`Classe de ativo nao encontrada para codigo ${code}`)
  }

  return assetClass.id
}

/**
 * Busca a conta padrao do usuario para vincular importacoes em lote.
 */
export async function getDefaultAccountForUser(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { portfolio: { userId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!account) {
    throw new Error('Nenhuma conta encontrada para o usuario autenticado')
  }

  return account.id
}

/**
 * Garante a existencia do ativo por ticker e retorna seu id.
 */
export async function upsertAssetFromImport(
  ticker: string,
  name: string,
  category: PosicaoRow['category'],
): Promise<string> {
  const assetClassId = await getAssetClassIdByCategory(category)
  const dbCategory = toDbCategory(category)

  const asset = await prisma.asset.upsert({
    where: { ticker },
    update: {
      name,
      category: dbCategory,
      assetClassId,
    },
    create: {
      ticker,
      name,
      category: dbCategory,
      assetClassId,
    },
    select: { id: true },
  })

  return asset.id
}

/**
 * Importa linhas de negociacao criando transacoes idempotentes.
 */
export async function importNegociacaoRows(userId: string, rows: NegociacaoRow[]): Promise<ImportResult> {
  const accountId = await getDefaultAccountForUser(userId)
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const category = inferCategoryFromTickerAndMarket(row.ticker, row.mercado)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)

      const tx = await createTransaction({
        referenceId: row.referenceId,
        type: row.type,
        accountId,
        assetId,
        quantity: row.quantity,
        price: row.price,
        totalAmount: row.total,
        date: row.date,
        notes: `Importacao B3 - Negociacao (${row.instituicao})`,
      })

      if (tx.idempotent) {
        skipped++
      } else {
        imported++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Negociacao ${row.referenceId}: ${message}`)
    }
  }

  return { imported, skipped, errors }
}

/**
 * Importa linhas de movimentacao criando transacoes idempotentes.
 */
export async function importMovimentacaoRows(userId: string, rows: MovimentacaoRow[]): Promise<ImportResult> {
  const accountId = await getDefaultAccountForUser(userId)
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const category = inferCategoryFromTickerAndMarket(row.ticker)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)
      const totalAmount = row.total ?? 0

      if (totalAmount <= 0) {
        skipped++
        continue
      }

      const tx = await createTransaction({
        referenceId: row.referenceId,
        type: row.type,
        accountId,
        assetId,
        quantity: row.quantity,
        price: row.price ?? undefined,
        totalAmount,
        date: row.date,
        notes: `Importacao B3 - Movimentacao (${row.instituicao})`,
      })

      if (tx.idempotent) {
        skipped++
      } else {
        imported++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Movimentacao ${row.referenceId}: ${message}`)
    }
  }

  return { imported, skipped, errors }
}

/**
 * Importa linhas de posicao sincronizando apenas o catalogo de ativos.
 */
export async function importPosicaoRows(rows: PosicaoRow[]): Promise<ImportResult> {
  let upserted = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      await upsertAssetFromImport(row.ticker, row.name, row.category)
      upserted++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Posicao ${row.ticker}: ${message}`)
    }
  }

  return { upserted, errors }
}
