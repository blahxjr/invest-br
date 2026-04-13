'use server'

import type { Account, Asset, IncomeType, Institution } from '@prisma/client'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/types/actions'
import { createIncomeEvent } from '@/modules/income/service'

type AccountWithInstitution = Account & { institution: Institution }

const incomeTypes: IncomeType[] = ['DIVIDEND', 'JCP', 'FII_RENT', 'COUPON', 'RENTAL']

export async function createIncomeEventAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Nao autenticado')
  }

  const accountId = String(formData.get('accountId') ?? '')
  const assetTicker = String(formData.get('assetTicker') ?? '').trim().toUpperCase()
  const type = String(formData.get('type') ?? '')
  const grossAmountInput = String(formData.get('grossAmount') ?? '')
  const taxAmountInput = String(formData.get('taxAmount') ?? '')
  const paymentDateInput = String(formData.get('paymentDate') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()

  if (!accountId || !type || !grossAmountInput || !paymentDateInput) {
    throw new Error('Campos obrigatorios faltando')
  }

  if (!incomeTypes.includes(type as IncomeType)) {
    throw new Error('Tipo de provento invalido')
  }

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      portfolio: { userId: session.user.id },
    },
  })

  if (!account) {
    throw new Error('Conta nao encontrada ou sem permissao')
  }

  const grossAmount = Number(grossAmountInput)
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new Error('Valor bruto invalido')
  }

  const taxAmount = taxAmountInput ? Number(taxAmountInput) : 0
  if (!Number.isFinite(taxAmount) || taxAmount < 0) {
    throw new Error('Valor de IR invalido')
  }

  const paymentDate = new Date(paymentDateInput)
  if (Number.isNaN(paymentDate.getTime())) {
    throw new Error('Data de pagamento invalida')
  }

  let assetId: string | undefined
  if (assetTicker) {
    const asset = await prisma.asset.findUnique({ where: { ticker: assetTicker } })
    if (!asset) {
      throw new Error('Ativo nao encontrado para o ticker informado')
    }
    assetId = asset.id
  }

  const netAmount = grossAmount - taxAmount
  if (netAmount < 0) {
    throw new Error('Liquido nao pode ser negativo')
  }

  await createIncomeEvent({
    type: type as IncomeType,
    accountId,
    assetId,
    grossAmount,
    taxAmount: taxAmountInput ? taxAmount : undefined,
    netAmount,
    paymentDate,
    notes: notes || undefined,
  })

  redirect('/income')
}

export async function getAccountsForUser(): Promise<ActionResult<AccountWithInstitution[]>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const accounts = await prisma.account.findMany({
    where: { portfolio: { userId: session.user.id } },
    include: { institution: true },
    orderBy: { name: 'asc' },
  })

  return { success: true, data: accounts }
}

export async function getAllAssetsForIncome(): Promise<ActionResult<Asset[]>> {
  const assets = await prisma.asset.findMany({
    where: { ticker: { not: null } },
    orderBy: { ticker: 'asc' },
  })

  return { success: true, data: assets }
}