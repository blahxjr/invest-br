'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { AssetCategory } from '@prisma/client'

/**
 * Atualiza um ativo com novos valores.
 */
export async function updateAsset(assetId: string, data: { name: string; category: AssetCategory }) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      name: data.name.trim(),
      category: data.category,
    },
  })

  revalidatePath('/assets')
}

/**
 * Deleta um ativo e todas suas transações/ledger entries.
 */
export async function deleteAsset(assetId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  // Delete all dependent records
  await prisma.$transaction(async (tx) => {
    // Find all transactions for this asset
    const transactions = await tx.transaction.findMany({
      where: { assetId },
      select: { id: true },
    })

    const txIds = transactions.map((t) => t.id)

    await tx.incomeEvent.deleteMany({
      where: { assetId },
    })

    await tx.subscriptionRight.deleteMany({
      where: { assetId },
    })

    // Delete ledger entries first (foreign key constraint)
    if (txIds.length > 0) {
      await tx.incomeEvent.deleteMany({
        where: { transactionId: { in: txIds } },
      })

      await tx.subscriptionRight.deleteMany({
        where: { transactionId: { in: txIds } },
      })

      await tx.ledgerEntry.deleteMany({
        where: { transactionId: { in: txIds } },
      })

      // Delete transactions
      await tx.transaction.deleteMany({
        where: { id: { in: txIds } },
      })
    }

    // Finally delete asset
    await tx.asset.delete({
      where: { id: assetId },
    })
  })

  revalidatePath('/assets')
}

/**
 * Atualiza uma classe de ativos (AssetClass).
 */
export async function updateAssetClass(classId: string, data: { name: string; description?: string }) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  await prisma.assetClass.update({
    where: { id: classId },
    data: {
      name: data.name.trim(),
      description: data.description,
    },
  })

  revalidatePath('/assets')
}

/**
 * Deleta uma classe de ativos (somente se não tiver ativos associados).
 */
export async function deleteAssetClass(classId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const cls = await prisma.assetClass.findUnique({
    where: { id: classId },
    select: { _count: { select: { assets: true } } },
  })

  if (cls && cls._count.assets > 0) {
    throw new Error('Não é possível remover uma classe que possui ativos associados')
  }

  await prisma.assetClass.delete({
    where: { id: classId },
  })

  revalidatePath('/assets')
}
