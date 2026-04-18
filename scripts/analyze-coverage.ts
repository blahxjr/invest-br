import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { classifyMovement } from '../src/modules/b3/parser/movimentacao'

type CoverageSample = {
  movimentacao: string
  entradaSaida: string
  ticker: string
  produto: string
  sourceFile: string
}

type GroupedResult = {
  sample: CoverageSample
  reason: string
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  type: string | null
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

  return {
    movimentacao,
    entradaSaida,
    ticker,
    produto,
    sourceFile,
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

  for (const sample of samples) {
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
}

main()
