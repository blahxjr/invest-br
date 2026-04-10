import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import {
  createInstitution,
  listInstitutions,
  updateInstitution,
} from '../../src/modules/institutions/service'

const TEST_PREFIX = `INST_TEST_${Date.now()}`
const createdInstitutionIds: string[] = []

beforeAll(async () => {
  await prisma.institution.deleteMany({
    where: {
      name: {
        startsWith: TEST_PREFIX,
      },
    },
  })
})

afterAll(async () => {
  if (createdInstitutionIds.length > 0) {
    await prisma.account.deleteMany({ where: { institutionId: { in: createdInstitutionIds } } })
    await prisma.institution.deleteMany({ where: { id: { in: createdInstitutionIds } } })
  }

  await prisma.institution.deleteMany({
    where: {
      name: {
        startsWith: TEST_PREFIX,
      },
    },
  })

  await prisma.$disconnect()
})

describe('createInstitution()', () => {
  it('cria instituição com nome sanitizado por trim e espaços', async () => {
    const institution = await createInstitution({
      name: `  ${TEST_PREFIX}   Banco   Principal  `,
      type: 'BANK',
    })

    createdInstitutionIds.push(institution.id)

    expect(institution.id).toBeDefined()
    expect(institution.name).toBe(`${TEST_PREFIX} Banco Principal`)
    expect(institution.type).toBe('BANK')
  })

  it('impede criação duplicada por nome case-insensitive', async () => {
    await createInstitution({
      name: `${TEST_PREFIX} Duplicada`,
      type: 'BROKER',
    }).then((institution) => {
      createdInstitutionIds.push(institution.id)
    })

    await expect(
      createInstitution({
        name: `${TEST_PREFIX} DUPLICADA`,
        type: 'BROKER',
      }),
    ).rejects.toThrow('Já existe uma instituição com este nome.')
  })

  it('valida nome obrigatório', async () => {
    await expect(
      createInstitution({
        name: '   ',
        type: 'OTHER',
      }),
    ).rejects.toThrow('Nome da instituição é obrigatório.')
  })

  it('valida tipo inválido', async () => {
    await expect(
      createInstitution({
        name: `${TEST_PREFIX} Tipo Inválido`,
        type: 'INVALID_TYPE' as unknown as never,
      }),
    ).rejects.toThrow('Tipo de instituição inválido.')
  })

  it('permite criar instituição sem tipo definido', async () => {
    const institution = await createInstitution({
      name: `${TEST_PREFIX} Sem Tipo`,
    })

    createdInstitutionIds.push(institution.id)

    expect(institution.id).toBeDefined()
    expect(institution.name).toBe(`${TEST_PREFIX} Sem Tipo`)
    expect(institution.type).toBeNull()
  })
})

describe('listInstitutions()', () => {
  it('lista instituições em ordem alfabética por nome', async () => {
    const institutionB = await createInstitution({
      name: `${TEST_PREFIX} Zeta`,
      type: 'OTHER',
    })
    createdInstitutionIds.push(institutionB.id)

    const institutionA = await createInstitution({
      name: `${TEST_PREFIX} Alfa`,
      type: 'OTHER',
    })
    createdInstitutionIds.push(institutionA.id)

    const institutions = await listInstitutions()
    const testInstitutions = institutions.filter((institution) =>
      institution.name.startsWith(TEST_PREFIX),
    )

    const names = testInstitutions.map((institution) => institution.name)
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b))

    expect(testInstitutions.length).toBeGreaterThanOrEqual(2)
    expect(names).toEqual(sortedNames)
  })

  it('retorna instituição recém-criada na listagem', async () => {
    const institution = await createInstitution({
      name: `${TEST_PREFIX} Listagem Explícita`,
      type: 'BROKER',
    })
    createdInstitutionIds.push(institution.id)

    const institutions = await listInstitutions()
    const listed = institutions.find((item) => item.id === institution.id)

    expect(listed).toBeDefined()
    expect(listed?.name).toBe(`${TEST_PREFIX} Listagem Explícita`)
    expect(listed?.type).toBe('BROKER')
  })
})

describe('updateInstitution()', () => {
  it('edita nome e tipo com validações e sanitização', async () => {
    const institution = await createInstitution({
      name: `${TEST_PREFIX} Editar`,
      type: 'BROKER',
    })
    createdInstitutionIds.push(institution.id)

    const updated = await updateInstitution(institution.id, {
      name: `   ${TEST_PREFIX}   Editada   `,
      type: 'BANK',
    })

    expect(updated.name).toBe(`${TEST_PREFIX} Editada`)
    expect(updated.type).toBe('BANK')
  })

  it('valida nome obrigatório no update quando informado', async () => {
    const institution = await createInstitution({
      name: `${TEST_PREFIX} Update Nome`,
      type: 'OTHER',
    })
    createdInstitutionIds.push(institution.id)

    await expect(updateInstitution(institution.id, { name: '   ' })).rejects.toThrow(
      'Nome da instituição é obrigatório.',
    )
  })

  it('valida tipo inválido no update', async () => {
    const institution = await createInstitution({
      name: `${TEST_PREFIX} Update Tipo`,
      type: 'OTHER',
    })
    createdInstitutionIds.push(institution.id)

    await expect(
      updateInstitution(institution.id, { type: 'INVALID_TYPE' as unknown as never }),
    ).rejects.toThrow('Tipo de instituição inválido.')
  })
})
