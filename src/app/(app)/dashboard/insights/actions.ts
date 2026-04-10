/**
 * Server Actions para o módulo Insights/Rebalanceamento
 */

'use server'

import { auth } from '@/lib/auth'
import { getInsightsForClient } from '@/modules/insights/service'
import { Insight } from '@/modules/insights/types'

/**
 * Ação de servidor para obter insights de uma carteira do cliente
 *
 * @param portfolioId ID opcional da carteira (se omitido, agrega todas)
 * @returns Array de insights detectados
 */
export async function getInsightsAction(portfolioId?: string | null): Promise<{
  success: boolean
  data?: Insight[]
  error?: string
}> {
  try {
    // Obter sessão do usuário autenticado
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Usuário não autenticado',
      }
    }

    // Buscar cliente do usuário (qualquer um servirá para V1)
    const { prisma } = await import('@/lib/prisma')
    const client = await prisma.client.findFirst({
      where: { userId: session.user.id },
    })

    if (!client) {
      return {
        success: false,
        error: 'Cliente não encontrado',
      }
    }

    // Chamar serviço de insights
    const insights = await getInsightsForClient(client.id, portfolioId)

    return {
      success: true,
      data: insights,
    }
  } catch (error) {
    console.error('Erro ao obter insights:', error)
    return {
      success: false,
      error: 'Erro ao processar solicitação',
    }
  }
}
