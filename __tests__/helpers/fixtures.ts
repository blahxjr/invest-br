import { randomUUID } from 'crypto'

type DeleteManyDelegate = {
  deleteMany: (args?: { where?: Record<string, unknown> }) => Promise<unknown>
}

export function uniqueSuffix() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

export function uniqueTicker(base = 'TST') {
  const normalized = base.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'TST'
  return `${normalized}${uniqueSuffix().slice(0, 5)}`
}

export function uniqueName(base: string) {
  return `${base} ${uniqueSuffix()}`
}

export async function safeDeleteMany(
  delegate: DeleteManyDelegate,
  where?: Record<string, unknown>,
) {
  try {
    await delegate.deleteMany(where ? { where } : undefined)
  } catch {
    // Cleanup de testes deve ser tolerante a estado parcial.
  }
}
