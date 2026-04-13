# Módulo Insights/Rebalanceamento — Contrato V1

> **Status:** Contrato definido (Subtarefa 2 — Planner)  
> **Versão:** V1 (on-the-fly, sem persistência)  
> **Data:** 2026-04-09

---

## Visão Geral

O módulo Insights/Rebalanceamento detecta anomalias e oportunidades em carteiras do cliente. **Na V1**, os insights são calculados **on-the-fly** (sem tabela `Insight` persistida), baseados em análise das posições consolidadas derivadas de transações.

**Objetivos principais:**
- Sinalizar concentração excessiva (ativo, classe, moeda/país)
- Detectar desalinhamento entre horizonte do ativo e objetivo da carteira
- Fornecer dados para UI exibir recomendações de rebalanceamento

---

## Tipos Suportados (V1)

Cada insight detecta uma anomalia específica:

| Tipo | Limite (DEC-015) | Descrição |
|------|------------------|-----------|
| `CONCENTRACAO_ATIVO` | ≤ 25% | Um ativo representa mais de 25% do patrimônio do cliente/carteira |
| `CONCENTRACAO_CLASSE` | ≤ 50% | Uma classe de ativo representa mais de 50% do patrimônio |
| `CONCENTRACAO_MOEDA_PAIS` | ≤ 70% | Uma moeda ou país representa mais de 70% do patrimônio |
| `HORIZONTE_DESALINHADO` | ≤ 30% | Um ativo com horizonte recomendado SHORT/MEDIUM está em carteira com objetivo LONG (ou similar discrepância) |

---

## Arquitetura de Cálculo

### 1. Entrada do Serviço

```typescript
type GetInsightsInput = {
  clientId: string          // Obrigatório: qual cliente
  portfolioId?: string      // Opcional: qual carteira (se omitido, agregar todas)
  date?: Date              // Opcional: data de cálculo (default = hoje)
}
```

**Uso:**
```typescript
const insights = await getInsightsForClient(clientId, portfolioId?, date?)
```

### 2. Fluxo de Cálculo (On-The-Fly)

1. **Buscar dados brutos:** Todas as `Transaction` do cliente/carteira (por período até `date`)
2. **Consolidar posições virtuais:**
   - Agrupar por `assetId`
   - Somar quantidades (BUY - SELL)
   - Calcular preço médio ponderado = Σ(quantidade × preço) / quantidade total
   - Mapear metadados: currency, country, horizonte (Asset + AssetClass)
3. **Agregar por moeda/país/classe** para cálculos de concentração
4. **Aplicar thresholds** para cada tipo de insight
5. **Retornar array de `Insight`**

### 3. Modelo Consolidado (Interno)

```typescript
type ConsolidatedPosition = {
  assetId: string
  assetName: string
  ticker?: string
  assetClassId: string
  assetClassName: string
  quantity: Decimal
  avgCost: Decimal                      // Preço médio das transações
  totalCost: Decimal                    // quantidade × avgCost
  currency: string                      // De Asset.currency (default BRL)
  country?: string                      // De Asset.country
  recommendedHorizon?: InvestmentHorizon // De Asset.recommendedHorizon
  classRecommendedHorizonBase?: InvestmentHorizon // De AssetClass.recommendedHorizonBase
  accounts: {                           // Breakdown por conta
    accountId: string
    accountName: string
    quantity: Decimal
    totalCost: Decimal
  }[]
}
```

### 4. Saída: Estructura de um Insight

```typescript
type Insight = {
  id: string                            // UUID (gerado, não persistido)
  type: InsightType                     // Um dos 4 tipos (enum abaixo)
  severity: 'info' | 'warning' | 'critical'
  title: string                         // Resumo para exibição
  message: string                       // Descrição detalhada
  scope: {                              // Em qual escopo o insight se aplica
    clientId: string
    portfolioId?: string
    assetId?: string
    assetClassId?: string
    currency?: string
    country?: string
  }
  metrics: {
    currentPercentage: number           // Ex: 0.28 (28%)
    threshold: number                   // Ex: 0.25 (25%)
    excessPercentage: number            // currentPercentage - threshold
  }
  affectedAssets: {                     // Quais ativos contribuem
    assetId: string
    assetName: string
    percentage: number
    absoluteValue: Decimal
  }[]
}
```

---

## Enum: InsightType

```typescript
enum InsightType {
  CONCENTRACAO_ATIVO = 'CONCENTRACAO_ATIVO',
  CONCENTRACAO_CLASSE = 'CONCENTRACAO_CLASSE',
  CONCENTRACAO_MOEDA_PAIS = 'CONCENTRACAO_MOEDA_PAIS',
  HORIZONTE_DESALINHADO = 'HORIZONTE_DESALINHADO',
}
```

---

## Thresholds (DEC-015)

Parâmetros padrão V1:

```typescript
const INSIGHT_THRESHOLDS = {
  concentracaoAtivo: 0.25,        // 25%
  concentracaoClasse: 0.50,       // 50%
  concentracaoMoedaPais: 0.70,    // 70%
  desalinhamentoHorizonte: 0.30,  // 30% de discrepância
}
```

**Severidade:**
- `info`: Concentração 0-10% acima do limite
- `warning`: 10-100% acima do limite
- `critical`: > 100% acima do limite

---

## Regras de Fallback e Edge Cases

### Horizonte Null
Se `Asset.recommendedHorizon` for null:
- Usar `AssetClass.recommendedHorizonBase`
- Se ambos forem null, **ignorar esse ativo** no cálculo de `HORIZONTE_DESALINHADO`

### Preço Médio Incompleto
- Transações `BUY`/`SELL` **obrigatoriamente** têm `price`
- Transações `DEPOSIT`/`WITHDRAWAL` (sem ativo associado) não afetam o cálculo
- Se houver GAPS de preço (ex.: herança sem preço), marcar como "custo desconhecido" no insight

### Moeda/País Null
- `currency` tem default `'BRL'` no schema (nunca null)
- `country` pode ser null — nesse caso, agregar como "país desconhecido" para fins de concentração

### PortfolioId Omitido
- Significa **agregar TODAS as carteiras do cliente**
- Se quiser insights por carteira específica, deve passar `portfolioId`

---

## Exemplos de Insights

### Exemplo 1: CONCENTRACAO_ATIVO

```json
{
  "id": "insght_001",
  "type": "CONCENTRACAO_ATIVO",
  "severity": "warning",
  "title": "WEGE3 representa 28% da carteira",
  "message": "Concentração elevada pode aumentar risco de volatilidade",
  "scope": {
    "clientId": "cli_123",
    "portfolioId": "pfo_456",
    "assetId": "ast_wege3"
  },
  "metrics": {
    "currentPercentage": 0.28,
    "threshold": 0.25,
    "excessPercentage": 0.03
  },
  "affectedAssets": [
    {
      "assetId": "ast_wege3",
      "assetName": "WEG S/A",
      "percentage": 0.28,
      "absoluteValue": 140000
    }
  ]
}
```

### Exemplo 2: CONCENTRACAO_MOEDA_PAIS

```json
{
  "id": "insght_002",
  "type": "CONCENTRACAO_MOEDA_PAIS",
  "severity": "info",
  "title": "80% do patrimônio em BRL",
  "message": "Considere diversificar em moedas/países para reduzir risco cambial",
  "scope": {
    "clientId": "cli_123",
    "portfolioId": "pfo_456",
    "currency": "BRL"
  },
  "metrics": {
    "currentPercentage": 0.80,
    "threshold": 0.70,
    "excessPercentage": 0.10
  },
  "affectedAssets": [
    {"assetId": "ast_wege3", "assetName": "WEG S/A", "percentage": 0.28, "absoluteValue": 140000},
    {"assetId": "ast_vale3", "assetName": "Vale S/A", "percentage": 0.30, "absoluteValue": 150000},
    {"assetId": "ast_itub4", "assetName": "Itaú", "percentage": 0.22, "absoluteValue": 110000}
  ]
}
```

---

## Próximos Passos (Roadmap)

### V1 (Atual)
- ✅ Contrato definido (tipos, enum, thresholds)
- ⏳ Implementação do serviço (3 detectores: concentração + horizonte)
- ⏳ UI: Dashboard com cards de insights
- ⏳ Testes: casos mínimos validados

### V2 (Futuro)
- Tabela `Position` persistida (snapshots históricos)
- Cache/snapshot de insights (melhor performance)
- Parâmetros customizáveis por cliente/plano (não fixos)
- Insights adicionais (ex.: liquidez baixa, ativos descontinuados, etc.)
- API para rebalanceamento automático

---

## Referências

- **DEC-015:** Insights V1 com cálculo on-the-fly, parâmetros padrão 25/50/70/30
- **Schema:** `enum InvestmentHorizon`, `Asset.currency`, `Asset.country`, `Asset.recommendedHorizon`, `AssetClass.recommendedHorizonBase`
- **Módulo:** `src/modules/insights/` (service.ts, types.ts)
