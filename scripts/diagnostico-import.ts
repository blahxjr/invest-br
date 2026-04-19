/**
 * Script de diagnóstico: testa o parser B3 em todos os arquivos de exemplo
 * e reporta estatísticas completas sem persistir no banco.
 *
 * Uso: npx tsx scripts/diagnostico-import.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { parseMovimentacaoForReview } from '../src/modules/b3/parser/movimentacao'
import { parsePosicaoForReview } from '../src/modules/b3/parser/posicao'
import type { RawSheet } from '../src/modules/b3/parser'

const EXEMPLOS_DIR = path.resolve(__dirname, '../docs/exemplos')

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function sheetRowsFromFile(filePath: string, sheetName?: string): Array<Array<string | number | null>> {
  const buf = fs.readFileSync(filePath)
  const text = new TextDecoder('utf-8').decode(buf)
  const wb = XLSX.read(text, { type: 'string', cellDates: false })
  const name = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) return []
  // Corrige células auto-detectadas como datas no formato americano pelo XLSX
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const cell = ws[addr] as XLSX.CellObject
    if (cell.t === 'n' && typeof cell.w === 'string') {
      const match = cell.w.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (match) {
        const [, m, d, yy] = match
        const yyyy = 2000 + Number(yy)
        const corrected = `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${yyyy}`
        cell.t = 's'
        cell.v = corrected
        cell.w = corrected
      }
    }
  }
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false }) as Array<Array<string | number | null>>
}

function sheetNameFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (/acoes/.test(lower)) return 'Acoes'
  if (/bdr/.test(lower)) return 'BDR'
  if (/etf/.test(lower)) return 'ETF'
  if (/fundos/.test(lower)) return 'Fundo de Investimento'
  if (/rendafixa|renda.fixa/.test(lower)) return 'Renda Fixa'
  if (/tesourodireto|tesouro.direto/.test(lower)) return 'Tesouro Direto'
  return path.basename(filename, '.csv')
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

// ──────────────────────────────────────────────
// Diagnóstico: Posição (6 arquivos)
// ──────────────────────────────────────────────

const posicaoFiles = [
  'acoes-2026-04-19-13-47-00.csv',
  'bdr-2026-04-19-13-47-00.csv',
  'etf-2026-04-19-13-47-00.csv',
  'fundos-2026-04-19-13-47-00.csv',
  'rendafixa-2026-04-19-13-47-00.csv',
  'tesourodireto-2026-04-19-13-47-00.csv',
]

console.log('\n══════════════════════════════════════════════════')
console.log('  DIAGNÓSTICO DE IMPORTAÇÃO B3')
console.log('  Data:', new Date().toLocaleString('pt-BR'))
console.log('══════════════════════════════════════════════════\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  POSIÇÃO (6 arquivos CSV)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const sheets: RawSheet[] = posicaoFiles.map((filename) => {
  const filePath = path.join(EXEMPLOS_DIR, filename)
  const rows = sheetRowsFromFile(filePath)
  const name = sheetNameFromFilename(filename)
  return { name, rows }
})

const posicaoLines = parsePosicaoForReview(sheets)

let posicaoOk = 0, posicaoRevisar = 0, posicaoIgnorar = 0
const posicaoPorCategoria: Record<string, number> = {}
const posicaoErros: string[] = []

for (const line of posicaoLines) {
  if (line.status === 'OK') posicaoOk++
  else if (line.status === 'REVISAR') posicaoRevisar++
  else posicaoIgnorar++

  const cat = line.normalized.category ?? 'SEM_CATEGORIA'
  posicaoPorCategoria[cat] = (posicaoPorCategoria[cat] ?? 0) + 1

  if (line.status !== 'OK') {
    posicaoErros.push(`  [${line.sheetName}] linha ${line.lineNumber} | ${line.status} | ${line.reason} | ticker=${line.normalized.ticker || '(vazio)'}`)
  }
}

const totalPosicao = posicaoLines.length
console.log(`Total de ativos parseados: ${totalPosicao}`)
console.log(`  ✅ OK:      ${posicaoOk} (${pct(posicaoOk, totalPosicao)})`)
console.log(`  ⚠️  REVISAR: ${posicaoRevisar} (${pct(posicaoRevisar, totalPosicao)})`)
console.log(`  ❌ IGNORAR: ${posicaoIgnorar} (${pct(posicaoIgnorar, totalPosicao)})`)
console.log('\nDistribuição por categoria:')
for (const [cat, count] of Object.entries(posicaoPorCategoria).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(15)} ${count}`)
}
if (posicaoErros.length > 0) {
  console.log('\nLinhas com problema:')
  posicaoErros.forEach((e) => console.log(e))
}

// ──────────────────────────────────────────────
// Diagnóstico: Movimentação
// ──────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  MOVIMENTAÇÃO')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const movFilePath = path.join(EXEMPLOS_DIR, 'movimentacao-2026-04-19-13-48-07.csv')
const movRows = sheetRowsFromFile(movFilePath)
const movLines = parseMovimentacaoForReview(movRows)

let movOk = 0, movRevisar = 0, movIgnorar = 0
const movPorTipo: Record<string, number> = {}
const movPorClassificacao: Record<string, number> = {}
const movRevisarRazoes: Record<string, number> = {}
const movIgnorarRazoes: Record<string, number> = {}
const movRevisarTiposOriginais: Record<string, number> = {}

for (const line of movLines) {
  if (line.status === 'OK') movOk++
  else if (line.status === 'REVISAR') movRevisar++
  else movIgnorar++

  const tp = line.normalized.type ?? 'null'
  movPorTipo[tp] = (movPorTipo[tp] ?? 0) + 1

  movPorClassificacao[line.classification] = (movPorClassificacao[line.classification] ?? 0) + 1

  if (line.status === 'REVISAR') {
    movRevisarRazoes[line.reason] = (movRevisarRazoes[line.reason] ?? 0) + 1
    const orig = line.raw.movimentacao
    movRevisarTiposOriginais[orig] = (movRevisarTiposOriginais[orig] ?? 0) + 1
  }

  if (line.status === 'IGNORAR') {
    movIgnorarRazoes[line.reason] = (movIgnorarRazoes[line.reason] ?? 0) + 1
  }
}

const totalMov = movLines.length
console.log(`Total de linhas: ${totalMov}`)
console.log(`  ✅ OK:      ${movOk} (${pct(movOk, totalMov)})`)
console.log(`  ⚠️  REVISAR: ${movRevisar} (${pct(movRevisar, totalMov)})`)
console.log(`  ❌ IGNORAR: ${movIgnorar} (${pct(movIgnorar, totalMov)})`)

console.log('\nDistribuição por tipo de transação:')
for (const [tp, count] of Object.entries(movPorTipo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tp.padEnd(25)} ${count}`)
}

console.log('\nDistribuição por classificação:')
for (const [cls, count] of Object.entries(movPorClassificacao).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cls.padEnd(25)} ${count}`)
}

if (Object.keys(movRevisarRazoes).length > 0) {
  console.log('\nMotivos REVISAR:')
  for (const [reason, count] of Object.entries(movRevisarRazoes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(35)} ${count}`)
  }
  console.log('\nTipos de movimentação originais em REVISAR:')
  for (const [orig, count] of Object.entries(movRevisarTiposOriginais).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${orig}".padEnd(40) → ${count}x`)
  }
}

if (Object.keys(movIgnorarRazoes).length > 0) {
  console.log('\nMotivos IGNORAR:')
  for (const [reason, count] of Object.entries(movIgnorarRazoes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(35)} ${count}`)
  }
}

// ──────────────────────────────────────────────
// Resumo executivo
// ──────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════')
console.log('  RESUMO EXECUTIVO')
console.log('══════════════════════════════════════════════════\n')
console.log(`Posição:      ${posicaoOk}/${totalPosicao} prontos (${posicaoRevisar} revisão, ${posicaoIgnorar} ignorados)`)
console.log(`Movimentação: ${movOk}/${totalMov} prontos (${movRevisar} revisão, ${movIgnorar} ignorados)`)

const movProblematicos = movRevisar + movIgnorar
if (movProblematicos > 0) {
  const pctProblema = Math.round((movProblematicos / totalMov) * 100)
  if (pctProblema > 20) {
    console.log(`\n⚠️  ATENÇÃO: ${pctProblema}% das movimentações precisam de revisão ou serão ignoradas.`)
  }
}
console.log()
