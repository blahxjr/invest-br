import { redirect } from 'next/navigation'
import type { Account, Asset, Institution } from '@prisma/client'
import IncomeEventForm from '@/components/IncomeEventForm'
import { getAccountsForUser, getAllAssetsForIncome } from './actions'

type AccountWithInstitution = Account & { institution: Institution }

export default async function NewIncomePage() {
  const [accountsResult, assetsResult] = await Promise.all([
    getAccountsForUser(),
    getAllAssetsForIncome(),
  ])

  if (!accountsResult.success) {
    if (accountsResult.error === 'UNAUTHORIZED') {
      redirect('/login')
    }
    redirect('/income')
  }

  if (!assetsResult.success) {
    redirect('/income')
  }

  const accounts = accountsResult.data as AccountWithInstitution[]
  const assets = assetsResult.data as Asset[]

  return <IncomeEventForm accounts={accounts} assets={assets} />
}