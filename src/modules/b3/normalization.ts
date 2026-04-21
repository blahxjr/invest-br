export type CanonicalAssetClassMeta = {
  semanticKey: string
  code: string | null
  name: string
  description: string | null
}

const ASSET_CLASS_META_BY_KEY: Record<string, Omit<CanonicalAssetClassMeta, 'semanticKey'>> = {
  ACOES: {
    code: 'ACOES',
    name: 'Ações',
    description: 'Ações de empresas listadas na B3',
  },
  FII: {
    code: 'FII',
    name: 'Fundos Imobiliários',
    description: 'FIIs negociados na B3',
  },
  ETF: {
    code: 'ETF',
    name: 'ETFs',
    description: 'Fundos de índice negociados em bolsa',
  },
  BDR: {
    code: 'BDR',
    name: 'BDRs',
    description: 'Brazilian Depositary Receipts',
  },
  RENDA_FIXA: {
    code: 'RENDA_FIXA',
    name: 'Renda Fixa',
    description: 'Títulos de renda fixa (Tesouro, CDB, LCI, LCA etc.)',
  },
  CRIPTO: {
    code: 'CRIPTO',
    name: 'Criptoativos',
    description: 'Criptomoedas e tokens',
  },
  OUTROS: {
    code: 'OUTROS',
    name: 'Outros',
    description: 'Ativos não classificados',
  },
}

const ASSET_CLASS_ALIASES = new Map<string, string>([
  ['ACAO', 'ACOES'],
  ['ACOES', 'ACOES'],
  ['FUNDO IMOBILIARIO', 'FII'],
  ['FUNDOS IMOBILIARIOS', 'FII'],
  ['FII', 'FII'],
  ['FIIS', 'FII'],
  ['ETF', 'ETF'],
  ['ETFS', 'ETF'],
  ['BDR', 'BDR'],
  ['BDRS', 'BDR'],
  ['RENDA FIXA', 'RENDA_FIXA'],
  ['RENDA_FIXA', 'RENDA_FIXA'],
  ['FIXED INCOME', 'RENDA_FIXA'],
  ['CRIPTO', 'CRIPTO'],
  ['CRIPTOATIVOS', 'CRIPTO'],
  ['CRYPTO', 'CRIPTO'],
  ['OUTRO', 'OUTROS'],
  ['OUTROS', 'OUTROS'],
])

function toAsciiUpper(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function collapseTokens(value: string): string {
  return toAsciiUpper(value)
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeInstitutionName(raw: string): string {
  const collapsed = collapseTokens(raw)

  if (!collapsed) {
    throw new Error('Nome de instituição vazio')
  }

  const tokens = collapsed.split(' ')
  const normalizedTokens: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]

    if (token === 'S' && next === 'A') {
      normalizedTokens.push('S.A.')
      index += 1
      continue
    }

    normalizedTokens.push(token)
  }

  return normalizedTokens.join(' ')
}

export function getCanonicalAssetClassKey(input: { code?: string | null; name?: string | null }): string | null {
  const normalizedCode = input.code ? collapseTokens(input.code) : ''
  if (normalizedCode) {
    return ASSET_CLASS_ALIASES.get(normalizedCode) ?? normalizedCode.replace(/\s+/g, '_')
  }

  const normalizedName = input.name ? collapseTokens(input.name) : ''
  if (!normalizedName) {
    return null
  }

  return ASSET_CLASS_ALIASES.get(normalizedName) ?? normalizedName.replace(/\s+/g, '_')
}

export function getCanonicalAssetClassMeta(input: {
  code?: string | null
  name?: string | null
  description?: string | null
}): CanonicalAssetClassMeta | null {
  const semanticKey = getCanonicalAssetClassKey(input)
  if (!semanticKey) {
    return null
  }

  const known = ASSET_CLASS_META_BY_KEY[semanticKey]
  if (known) {
    return {
      semanticKey,
      code: known.code,
      name: known.name,
      description: known.description,
    }
  }

  return {
    semanticKey,
    code: input.code?.trim().toUpperCase() ?? null,
    name: input.name?.trim() || semanticKey.replace(/_/g, ' '),
    description: input.description?.trim() || null,
  }
}