import { describe, expect, it } from 'vitest'
import { getCanonicalAssetClassKey, getCanonicalAssetClassMeta, normalizeInstitutionName } from '@/modules/b3/normalization'

describe('normalizeInstitutionName', () => {
  it('canoniza variacoes societarias do BTG para o mesmo nome', () => {
    expect(normalizeInstitutionName('BANCO BTG PACTUAL S/A')).toBe('BANCO BTG PACTUAL S.A.')
    expect(normalizeInstitutionName('Banco BTG Pactual S.A.')).toBe('BANCO BTG PACTUAL S.A.')
  })

  it('remove acentos, pontuacao redundante e espacos extras', () => {
    expect(normalizeInstitutionName('  Nu Investimentos S.A. - CTVM  ')).toBe('NU INVESTIMENTOS S.A. CTVM')
  })
})

describe('asset class canonicalization', () => {
  it('resolve classes equivalentes de renda fixa para a mesma chave semantica', () => {
    expect(getCanonicalAssetClassKey({ code: 'RENDA_FIXA', name: 'Renda Fixa' })).toBe('RENDA_FIXA')
    expect(getCanonicalAssetClassKey({ name: 'Renda Fixa' })).toBe('RENDA_FIXA')
  })

  it('retorna metadados canonicos para acoes e renda fixa', () => {
    expect(getCanonicalAssetClassMeta({ code: 'ACAO', name: 'Acao' })).toMatchObject({
      semanticKey: 'ACOES',
      code: 'ACOES',
      name: 'Ações',
    })
    expect(getCanonicalAssetClassMeta({ name: 'Renda Fixa' })).toMatchObject({
      semanticKey: 'RENDA_FIXA',
      code: 'RENDA_FIXA',
      name: 'Renda Fixa',
    })
  })
})


