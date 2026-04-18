import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { classifyMovement, resolveAssetClass, type AssetClass } from '../src/modules/b3/parser/movimentacao'

export type CoverageSample = {
  movimentacao: string
  entradaSaida: string
  ticker: string
  produto: string
  sourceFile: string
  monetaryValue: number | null
}

type AuditedSample = CoverageSample & {
  assetClass: AssetClass | null
}

export type AuditInput = AuditedSample

type GroupedResult = {
  sample: CoverageSample
  reason: string
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  type: string | null
}

export type AuditResult = {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

type ClassifiedMovement = ReturnType<typeof classifyMovement>

function normalizeDirection(value: string): 'IN' | 'OUT' | 'UNKNOWN' {
  const normalized = asText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized === 'credito' || normalized === 'entrada') return 'IN'
  if (normalized === 'debito' || normalized === 'saida') return 'OUT'
  return 'UNKNOWN'
}

function parseMonetaryValue(value: unknown): number | null {
  const raw = asText(value)
  if (!raw || raw === '-' || raw.toUpperCase() === 'REVISAR') return null

  const normalized = raw
    .replace(/\./g, '')
    .replace(',', '.')

  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

export function validateTransactionConsistency(input: AuditInput, classified: ClassifiedMovement): AuditResult {
  const errors: string[] = []
  const warnings: string[] = []
  const direction = normalizeDirection(input.entradaSaida)
  const hasRelevantMonetaryValue = typeof input.monetaryValue === 'number' && Math.abs(input.monetaryValue) >= 0.01
  const classifiedType = String(classified.type ?? '')

  if (!input.assetClass) {
    errors.push('asset_class_ausente: Asset class nao identificada — bloquear ingestao')
  }

  if (direction === 'IN' && classified.isIncoming !== true) {
    errors.push('entrada_saida_inconsistente: entrada deve gerar isIncoming=true')
  }

  if (direction === 'OUT' && classified.isIncoming !== false) {
    errors.push('entrada_saida_inconsistente: saida deve gerar isIncoming=false')
  }

  if (classifiedType === 'BUY' && classified.isIncoming !== false) {
    errors.push('tipo_buy_inconsistente: BUY deve gerar isIncoming=false')
  }

  if (classifiedType === 'SELL' && classified.isIncoming !== true) {
    errors.push('tipo_sell_inconsistente: SELL deve gerar isIncoming=true')
  }

  if ((classifiedType === 'INCOME' || classifiedType === 'DIVIDEND') && classified.isIncoming !== true) {
    errors.push('tipo_income_inconsistente: INCOME/DIVIDEND deve gerar isIncoming=true')
  }

  if (classifiedType === 'MATURITY' && classified.isIncoming !== true) {
    errors.push('tipo_maturity_inconsistente: MATURITY deve gerar isIncoming=true')
  }

  if (classifiedType === 'CUSTODY_TRANSFER' && hasRelevantMonetaryValue) {
    warnings.push('custody_transfer_com_valor: transferencia de custodia nao deve impactar caixa')
  }

  if (classifiedType === 'SUBSCRIPTION_RIGHT' && hasRelevantMonetaryValue) {
    errors.push('subscription_right_com_valor: direito de subscricao nao deve ter valor financeiro')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

function readCsvRows(filePath: string): Record<string, unknown>[] {
  const workbook = XLSX.readFile(filePath, { raw: false })
  const firstSheet = workbook.SheetNames[0]

  if (!firstSheet) return []

  const worksheet = workbook.Sheets[firstSheet]
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  })
}

function asText(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return raw

  if (raw.includes('Ã') || raw.includes('Â')) {
    return Buffer.from(raw, 'latin1').toString('utf8').trim()
  }

  return raw
}

function extractMovementSample(row: Record<string, unknown>, sourceFile: string): CoverageSample | null {
  const movimentacao = asText(
    row.orig_movimentacao ??
      row.origem_movimentacao ??
      row.movimentacao_original ??
      row.movimentacao ??
      row.Movimentacao ??
      row['Movimentação'],
  )

  if (!movimentacao) return null

  const entradaSaida = asText(row.orig_entrada_saida ?? row.entrada_saida ?? 'Credito') || 'Credito'
  const ticker = asText(row.ativo_ticker ?? row.ticker ?? row.orig_ticker)
  const produto = asText(row.orig_produto ?? row.produto ?? row.ativo_nome_limpo)
  const monetaryValue = parseMonetaryValue(row.valor_total_numerico ?? row.valor_total ?? row.orig_valor_operacao)

  return {
    movimentacao,
    entradaSaida,
    ticker,
    produto,
    sourceFile,
    monetaryValue,
  }
}

function getCoverageSamples(rootDir: string): CoverageSample[] {
  const dataDir = path.join(rootDir, 'docs', 'normalizado')
  if (!fs.existsSync(dataDir)) return []

  const preferredNormalizado = fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.normalizado.csv'))
    .map((name) => path.join(dataDir, name))

  const csvFiles = preferredNormalizado.length > 0
    ? preferredNormalizado
    : fs
        .readdirSync(dataDir)
        .filter((name) => name.endsWith('.csv'))
        .map((name) => path.join(dataDir, name))

  const byMovement = new Map<string, CoverageSample>()

  for (const filePath of csvFiles) {
    const rows = readCsvRows(filePath)

    for (const row of rows) {
      const sample = extractMovementSample(row, path.relative(rootDir, filePath))
      if (!sample) continue
      if (!byMovement.has(sample.movimentacao)) {
        byMovement.set(sample.movimentacao, sample)
      }
    }
  }

  return [...byMovement.values()].sort((a, b) => a.movimentacao.localeCompare(b.movimentacao, 'pt-BR'))
}

function main() {
  const rootDir = process.cwd()
  const samples = getCoverageSamples(rootDir)

  if (samples.length === 0) {
    console.log('Nenhum dado de movimentacao encontrado em docs/normalizado/*.csv')
    process.exit(0)
  }

  const mapped: GroupedResult[] = []
  const reviewRequired: GroupedResult[] = []
  const unknown: GroupedResult[] = []
  const auditErrors: Array<{ sample: AuditedSample; errors: string[]; type: string | null }> = []
  const auditWarnings: Array<{ sample: AuditedSample; warnings: string[]; type: string | null }> = []

  for (const sample of samples) {
    let assetClass: AssetClass | null = null
    try {
      assetClass = resolveAssetClass(sample.produto, sample.ticker)
    } catch {
      auditErrors.push({
        sample: {
          ...sample,
          assetClass: null,
        },
        errors: ['asset_class_ausente: Asset class nao identificada — bloquear ingestao'],
        type: null,
      })
      continue
    }

    const auditedSample: AuditedSample = {
      ...sample,
      assetClass,
    }

    const result = classifyMovement({
      entradaSaida: sample.entradaSaida,
      movimentacao: sample.movimentacao,
      ticker: sample.ticker,
      produto: sample.produto,
    })

    const entry: GroupedResult = {
      sample,
      reason: result.reason,
      status: result.status,
      type: result.type,
    }

    if (result.type && result.status === 'OK') {
      const audit = validateTransactionConsistency(auditedSample, result)
      if (audit.errors.length > 0) {
        auditErrors.push({
          sample: auditedSample,
          errors: audit.errors,
          type: result.type,
        })
      }

      if (audit.warnings.length > 0) {
        auditWarnings.push({
          sample: auditedSample,
          warnings: audit.warnings,
          type: result.type,
        })
      }

      mapped.push(entry)
      continue
    }

    if (result.reason === 'tipo_movimentacao_desconhecido') {
      unknown.push(entry)
      continue
    }

    reviewRequired.push(entry)
  }

  console.log('=== Relatorio de Cobertura de Movimentacao B3 ===')
  console.log(`Total de movimentacoes unicas analisadas: ${samples.length}`)
  console.log(`Mapeados: ${mapped.length}`)
  console.log(`ReviewRequired: ${reviewRequired.length}`)
  console.log(`Unknown: ${unknown.length}`)

  console.log('\n--- ReviewRequired ---')
  if (reviewRequired.length === 0) {
    console.log('Nenhum caso em revisao.')
  } else {
    for (const item of reviewRequired) {
      console.log(
        `- ${item.sample.movimentacao} | reason=${item.reason} | entradaSaida=${item.sample.entradaSaida} | produto=${item.sample.produto || item.sample.ticker || '-'} | source=${item.sample.sourceFile}`,
      )
    }
  }

  console.log('\n--- Unknown ---')
  if (unknown.length === 0) {
    console.log('Nenhum caso desconhecido.')
  } else {
    for (const item of unknown) {
      console.log(
        `- ${item.sample.movimentacao} | reason=${item.reason} | entradaSaida=${item.sample.entradaSaida} | produto=${item.sample.produto || item.sample.ticker || '-'} | source=${item.sample.sourceFile}`,
      )
    }
  }

  console.log('\n=== Audit Errors ===')
  if (auditErrors.length === 0) {
    console.log('Nenhum erro contabil encontrado.')
  } else {
    for (const issue of auditErrors) {
      console.log(
        `- ${issue.sample.movimentacao} | type=${issue.type ?? 'null'} | entradaSaida=${issue.sample.entradaSaida} | produto=${issue.sample.produto || issue.sample.ticker || '-'} | errors=${issue.errors.join('; ')} | source=${issue.sample.sourceFile}`,
      )
    }
  }

  console.log('\n=== Audit Warnings ===')
  if (auditWarnings.length === 0) {
    console.log('Nenhum warning contabil encontrado.')
  } else {
    for (const issue of auditWarnings) {
      console.log(
        `- ${issue.sample.movimentacao} | type=${issue.type ?? 'null'} | entradaSaida=${issue.sample.entradaSaida} | produto=${issue.sample.produto || issue.sample.ticker || '-'} | warnings=${issue.warnings.join('; ')} | source=${issue.sample.sourceFile}`,
      )
    }
  }

  if (auditErrors.length > 0) {
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
