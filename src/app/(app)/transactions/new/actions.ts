'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { createTransaction } from '@/modules/transactions/service'
import { randomUUID } from 'crypto'

export async function createTransactionAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const accountId = formData.get('accountId') as string
  const type = formData.get('type') as TransactionType
  const ticker = formData.get('ticker') as string
  const quantity = formData.get('quantity') as string
  const price = formData.get('price') as string
  const totalAmount = formData.get('totalAmount') as string
  const date = formData.get('date') as string
  const notes = formData.get('notes') as string

  if (!accountId || !type || !totalAmount || !date) {
    throw new Error('Campos obrigatórios faltando')
  }

  // Verifica que a conta pertence ao usuário
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      portfolio: { userId: session.user.id },
    },
  })

  if (!account) {
    throw new Error('Conta não encontrada ou sem permissão')
  }

  // Resolve assetId pelo ticker
  let assetId: string | undefined
  if (ticker?.trim()) {
    const asset = await prisma.asset.findUnique({ where: { ticker: ticker.trim().toUpperCase() } })
    assetId = asset?.id
  }

  const total = parseFloat(totalAmount)
  const qty = quantity ? parseFloat(quantity) : undefined
  const unitPrice = price ? parseFloat(price) : undefined

  await createTransaction({
    referenceId: randomUUID(),
    type,
    accountId,
    assetId,
    quantity: qty,
    price: unitPrice,
    totalAmount: total,
    date: new Date(date),
    notes: notes?.trim() || undefined,
  })

  redirect('/transactions')
}

export async function getAccountsForUser() {
  const session = await auth()
  if (!session?.user?.id) return []

  return prisma.account.findMany({
    where: { portfolio: { userId: session.user.id } },
    include: { institution: true },
    orderBy: { name: 'asc' },
  })
}

export async function getAllAssets() {
  return prisma.asset.findMany({
    where: { ticker: { not: null } },
    orderBy: { ticker: 'asc' },
    select: { id: true, ticker: true, name: true },
  })
}
