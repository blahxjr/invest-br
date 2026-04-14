# Arquitetura InvestBR

## Camadas
[Client] -> [Next.js Server Components / Route Handlers]
				 -> [Modules (service.ts)]
				 -> [Prisma ORM]
				 -> [PostgreSQL]

## Modulos e dependencias
- positions/service -> prisma (Transaction + Asset)
- dashboard/data -> positions/service + prisma (IncomeEvent)
- quotes (lib) -> fetch externo (Brapi), sem dependencia de prisma
- b3/service -> prisma (Transaction + Asset + Account)
- income/service -> prisma (IncomeEvent + Account + Asset)

## Boundary Server -> Client
Toda prop com Decimal deve ser serializada para string ou number antes de cruzar para Client Components (DEC-016).

- PositionWithQuote -> SerializedPositionWithQuote em src/modules/positions/types.ts
- AllocationItem -> serializado em src/app/(app)/dashboard/page.tsx
- Snapshots de patrimonio -> serializados em src/app/(app)/performance/page.tsx

## Fluxo de dados: /positions
page.tsx (Server)
	-> getPositions(userId)        [1 query Prisma]
	-> getQuotes(tickers[])        [fetch Brapi, cache 5 min]
	-> enrichWithQuotes()          [funcao pura, em memoria]
	-> serialize Decimal -> string
	-> <PositionsPageClient />     [Client Component]
