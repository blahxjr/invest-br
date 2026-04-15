/**
 * Server Actions para Rebalanceamento
 */

'use server'

import Decimal from 'decimal.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const AllocationTargetSchema = z.object({
  assetClass: z.string(),
  targetPct: z.number().min(0).max(100),
})

const SaveAllocationTargetsSchema = z.object({
  targets: z.array(AllocationTargetSchema),
})

/**
 * Salva os targets de alocação para um usuário
 * 
 * Validações:
 * - Soma dos percentuais deve ser 100 (± 0.01 tolerância)
 * - Cada target tem assetClass e targetPct
 * 
 * @param targets Array de targets (assetClass, targetPct)
 * @returns { success: boolean; error?: string }
 */
export async function saveAllocationTargets(
  userId: string,
  targets: z.infer<typeof AllocationTargetSchema>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validar entrada
    const validated = SaveAllocationTargetsSchema.parse({ targets })

    // 2. Obter session do usuário
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }
    if (session.user.id !== userId) {
      return { success: false, error: 'Usuário inválido para atualização da configuração' }
    }

    // 3. Validar soma dos percentuais (deve ser 100 ± 0.01)
    const sum = validated.targets.reduce((acc, target) => acc.plus(new Decimal(target.targetPct)), new Decimal(0))
    const tolerance = new Decimal('0.01')
    if (sum.minus(100).abs().gt(tolerance)) {
      return {
        success: false,
        error: `Soma dos percentuais deve ser 100%. Atual: ${sum.toFixed(2)}%`,
      }
    }

    // 4. Salvar via upsert em transação
    await prisma.$transaction([
      // Remover targets existentes
      prisma.allocationTarget.deleteMany({
        where: { userId },
      }),
      // Criar novos targets
      ...validated.targets.map((target) =>
        prisma.allocationTarget.create({
          data: {
            userId,
            assetClass: target.assetClass,
            targetPct: target.targetPct,
          },
        })
      ),
    ])

    return { success: true }
  } catch (error) {
    console.error('Error saving allocation targets:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Dados inválidos' }
    }
    return { success: false, error: 'Erro ao salvar configuração' }
  }
}
