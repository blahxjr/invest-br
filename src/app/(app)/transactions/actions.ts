'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Conversão de Decimal para string para JSON ──────────────────────────────
/**
 * Serializa um objeto para JSON, convertendo Decimal para string.
 * Necessário porque Decimal não é JSON-serializable (DEC-016).
 */
function serializeToJSON(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value instanceof Prisma.Decimal) {
      return value.toString()
    }
    return value
  })
}

// ─── Validação com Zod ──────────────────────────────────────────────────────

const TransactionUpdateSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'INCOME', 'RENT']).optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  date: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val)
    }
    return val
  }).optional(),
  notes: z.string().nullable().optional(),
})

const IncomeEventUpdateSchema = z.object({
  type: z.enum(['DIVIDEND', 'JCP', 'FII_RENT', 'COUPON', 'RENTAL']).optional(),
  grossAmount: z.union([z.string(), z.number()]).optional(),
  taxAmount: z.union([z.string(), z.number()]).nullable().optional(),
  netAmount: z.union([z.string(), z.number()]).optional(),
  paymentDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val)
    }
    return val
  }).optional(),
  notes: z.string().nullable().optional(),
})

// ─── Server Action: Atualizar Transação ─────────────────────────────────────

export async function updateTransaction(
  transactionId: string,
  data: z.infer<typeof TransactionUpdateSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    // Validar entrada com Zod
    const validatedData = TransactionUpdateSchema.parse(data)

    // Buscar transação atual para auditoria
    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true, asset: true },
    })

    if (!currentTransaction) {
      throw new Error('Transaction not found')
    }

    // Recalcular totalAmount se quantity ou price forem alterados
    const quantity = validatedData.quantity ?? currentTransaction.quantity
    const price = validatedData.price ?? currentTransaction.price
    let totalAmount = currentTransaction.totalAmount

    if (validatedData.quantity != null || validatedData.price != null) {
      if (quantity != null && price != null) {
        totalAmount = new Prisma.Decimal(quantity.toString()).times(
          new Prisma.Decimal(price.toString())
        )
      }
    }

    // Preparar dados de auditoria
    const previousValue = serializeToJSON({
      type: currentTransaction.type,
      quantity: currentTransaction.quantity,
      price: currentTransaction.price,
      totalAmount: currentTransaction.totalAmount,
      date: currentTransaction.date,
      notes: currentTransaction.notes,
    })

    const newValue = serializeToJSON({
      type: validatedData.type ?? currentTransaction.type,
      quantity: quantity,
      price: price,
      totalAmount,
      date: validatedData.date ?? currentTransaction.date,
      notes: validatedData.notes ?? currentTransaction.notes,
    })

    // Executar atomicamente: criar AuditLog + atualizar Transaction
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: 'TRANSACTION',
          entityId: transactionId,
          action: 'UPDATE',
          previousValue,
          newValue,
          changedBy: session.user.id,
        },
      })

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          type: validatedData.type ?? undefined,
          quantity: quantity != null ? new Prisma.Decimal(quantity.toString()) : undefined,
          price: price != null ? new Prisma.Decimal(price.toString()) : undefined,
          totalAmount,
          date: validatedData.date ?? undefined,
          notes: validatedData.notes ?? undefined,
        },
      })
    })

    revalidatePath('/transactions')
    return { success: true }
  } catch (error) {
    console.error('Failed to update transaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Server Action: Deletar Transação (soft delete com auditoria) ────────────

export async function deleteTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    // Buscar transação para auditoria
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    // Preparar dados de auditoria
    const previousValue = serializeToJSON({
      id: transaction.id,
      referenceId: transaction.referenceId,
      type: transaction.type,
      quantity: transaction.quantity,
      price: transaction.price,
      totalAmount: transaction.totalAmount,
      date: transaction.date,
      notes: transaction.notes,
    })

    // Executar atomicamente: criar AuditLog + soft-delete
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: 'TRANSACTION',
          entityId: transactionId,
          action: 'DELETE',
          previousValue,
          newValue: null,
          changedBy: session.user.id,
        },
      })

      await tx.transaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() },
      })
    })

    revalidatePath('/transactions')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete transaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Server Action: Atualizar IncomeEvent ───────────────────────────────────

export async function updateIncomeEvent(
  incomeEventId: string,
  data: z.infer<typeof IncomeEventUpdateSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const validatedData = IncomeEventUpdateSchema.parse(data)

    const currentEvent = await prisma.incomeEvent.findUnique({
      where: { id: incomeEventId },
    })

    if (!currentEvent) {
      throw new Error('Income event not found')
    }

    const previousValue = serializeToJSON({
      type: currentEvent.type,
      grossAmount: currentEvent.grossAmount,
      taxAmount: currentEvent.taxAmount,
      netAmount: currentEvent.netAmount,
      paymentDate: currentEvent.paymentDate,
      notes: currentEvent.notes,
    })

    const newValue = serializeToJSON({
      type: validatedData.type ?? currentEvent.type,
      grossAmount: validatedData.grossAmount ?? currentEvent.grossAmount,
      taxAmount: validatedData.taxAmount ?? currentEvent.taxAmount,
      netAmount: validatedData.netAmount ?? currentEvent.netAmount,
      paymentDate: validatedData.paymentDate ?? currentEvent.paymentDate,
      notes: validatedData.notes ?? currentEvent.notes,
    })

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: 'INCOME',
          entityId: incomeEventId,
          action: 'UPDATE',
          previousValue,
          newValue,
          changedBy: session.user.id,
        },
      })

      await tx.incomeEvent.update({
        where: { id: incomeEventId },
        data: {
          type: validatedData.type ?? undefined,
          grossAmount:
            validatedData.grossAmount != null
              ? new Prisma.Decimal(validatedData.grossAmount.toString())
              : undefined,
          taxAmount:
            validatedData.taxAmount != null
              ? new Prisma.Decimal(validatedData.taxAmount.toString())
              : undefined,
          netAmount:
            validatedData.netAmount != null
              ? new Prisma.Decimal(validatedData.netAmount.toString())
              : undefined,
          paymentDate: validatedData.paymentDate ?? undefined,
          notes: validatedData.notes ?? undefined,
        },
      })
    })

    revalidatePath('/income')
    return { success: true }
  } catch (error) {
    console.error('Failed to update income event:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Server Action: Deletar IncomeEvent (soft delete com auditoria) ─────────

export async function deleteIncomeEvent(incomeEventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const event = await prisma.incomeEvent.findUnique({
      where: { id: incomeEventId },
    })

    if (!event) {
      throw new Error('Income event not found')
    }

    const previousValue = serializeToJSON({
      id: event.id,
      type: event.type,
      grossAmount: event.grossAmount,
      taxAmount: event.taxAmount,
      netAmount: event.netAmount,
      paymentDate: event.paymentDate,
      notes: event.notes,
    })

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: 'INCOME',
          entityId: incomeEventId,
          action: 'DELETE',
          previousValue,
          newValue: null,
          changedBy: session.user.id,
        },
      })

      // Soft delete com campo deletedAt
      await tx.incomeEvent.update({
        where: { id: incomeEventId },
        data: { deletedAt: new Date() },
      })
    })

    revalidatePath('/income')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete income event:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
