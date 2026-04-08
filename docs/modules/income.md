# Módulo: Income Events & Rentais

## Responsabilidade

Registro e consulta de eventos de renda passiva (dividendos, JCP, FII, cupons) e de recibos de aluguel imobiliário. Inclui cálculo de posição de ativos derivado do histórico de transações.

---

## Entidades do Schema

### `IncomeEvent`

| Campo          | Tipo           | Descrição                                    |
|---------------|----------------|----------------------------------------------|
| `id`           | `String` (cuid)| PK                                           |
| `type`         | `IncomeType`   | Tipo do evento de renda                      |
| `accountId`    | `String`       | Conta que recebeu o rendimento               |
| `assetId`      | `String?`      | Ativo gerador (nulo para JCP sem ativo)      |
| `transactionId`| `String?`      | Transação de referência (opcional)           |
| `grossAmount`  | `Decimal(18,2)`| Valor bruto                                  |
| `taxAmount`    | `Decimal(18,2)?`| IR retido na fonte                          |
| `netAmount`    | `Decimal(18,2)`| Valor líquido creditado                     |
| `paymentDate`  | `DateTime`     | Data de pagamento                            |
| `notes`        | `String?`      | Observações livres                           |
| `createdAt`    | `DateTime`     | Criação do registro                          |

### `RentalReceipt`

| Campo          | Tipo           | Descrição                                    |
|---------------|----------------|----------------------------------------------|
| `id`           | `String` (cuid)| PK                                           |
| `propertyName` | `String`       | Nome/identificação do imóvel                 |
| `accountId`    | `String`       | Conta vinculada                              |
| `grossRent`    | `Decimal(18,2)`| Aluguel bruto                                |
| `expenses`     | `Decimal(18,2)?`| Despesas (condomínio, IPTU, etc.)           |
| `netRent`      | `Decimal(18,2)`| Rendimento líquido                           |
| `paymentDate`  | `DateTime`     | Data de recebimento                          |
| `createdAt`    | `DateTime`     | Criação do registro                          |

### Enum `IncomeType`

| Valor       | Descrição                              |
|-------------|----------------------------------------|
| `DIVIDEND`  | Dividendo de ação                      |
| `JCP`       | Juros sobre Capital Próprio            |
| `FII_RENT`  | Rendimento mensal de FII               |
| `COUPON`    | Cupom de renda fixa                    |
| `RENTAL`    | Aluguel de imóvel físico               |

---

## Serviços — `src/modules/income/service.ts`

### `createIncomeEvent(input: IncomeEventCreateInput)`

Cria um evento de renda passiva.

```typescript
const event = await createIncomeEvent({
  type: 'DIVIDEND',
  accountId: '...',
  assetId: '...',        // opcional
  grossAmount: 100,
  taxAmount: 15,
  netAmount: 85,
  paymentDate: new Date('2026-03-15'),
})
```

### `getIncomeEventsByAccount(accountId: string)`

Retorna todos os eventos de renda de uma conta, ordenados por `paymentDate` descrescente. Inclui o `asset` relacionado.

### `getTotalIncomeByAccount(accountId: string): Promise<Decimal>`

Soma todos os `netAmount` de `IncomeEvent` da conta. Útil para dashboard.

### `createRentalReceipt(input: RentalReceiptCreateInput)`

Cria um recibo de aluguel imobiliário.

```typescript
const receipt = await createRentalReceipt({
  propertyName: 'Ap. Moema 42',
  accountId: '...',
  grossRent: 3500,
  expenses: 320.75,
  netRent: 3179.25,
  paymentDate: new Date('2026-03-05'),
})
```

### `getRentalReceiptsByAccount(accountId: string)`

Retorna todos os recibos de aluguel de uma conta, ordenados por `paymentDate` descrescente.

### `calculatePositionByAsset(accountId, assetId): Promise<AssetPosition | null>`

Deriva a posição atual de um ativo em uma conta a partir do histórico completo de transações `BUY`/`SELL`. Retorna `null` se o ativo não existir.

**Algoritmo de custo médio ponderado:**
- `BUY`: `novo_custo_medio = (qty_anterior × custo_anterior + qty_nova × price_nova) / qty_total`
- `SELL`: mantém `averageCost`, reduz `quantity` e `totalCost = averageCost × quantity`

```typescript
const position = await calculatePositionByAsset(accountId, assetId)
// {
//   assetId, ticker, name,
//   quantity: Decimal,
//   averageCost: Decimal,
//   totalCost: Decimal,
//   buyCount: number,
//   sellCount: number,
// }
```

### `getPositionsByAccount(accountId): Promise<AssetPosition[]>`

Retorna todas as posições abertas (quantidade > 0) de uma conta. Consulta os `assetId` distintos e agrega via `calculatePositionByAsset`.

---

## Tipos — `src/modules/income/types.ts`

```typescript
import type { IncomeType, Decimal } from '@prisma/client'

type IncomeEventCreateInput = { type: IncomeType; accountId; grossAmount; netAmount; paymentDate; ... }
type RentalReceiptCreateInput = { propertyName; accountId; grossRent; netRent; paymentDate; ... }
type AssetPosition = { assetId; ticker; name; quantity; averageCost; totalCost; buyCount; sellCount }
```

---

## Testes — `__tests__/modules/income.test.ts`

8 testes cobrindo:

| Teste | Cobertura |
|-------|-----------|
| `createIncomeEvent` DIVIDEND | Dividendo com IR retido |
| `createIncomeEvent` FII_RENT | Rendimento isento — FII |
| `getIncomeEventsByAccount` | Ordenação por data desc |
| `getTotalIncomeByAccount` | Soma de rendimentos líquidos |
| `createRentalReceipt` | Aluguel com despesas |
| `calculatePositionByAsset` — apenas compras | Custo médio após 2 compras |
| `calculatePositionByAsset` — compra + venda parcial | Manutenção do custo médio na venda |
| `getPositionsByAccount` | Lista posições abertas (qty > 0) |

---

## Migration

`20260408011457_income_rentals` — cria tabelas `income_events` e `rental_receipts` com enum `IncomeType`.
