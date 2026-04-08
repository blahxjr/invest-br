# Módulo: Assets (Catálogo de Ativos)

## Objetivo

Manter o catálogo central de ativos financeiros e classes de ativos disponíveis no sistema. É a referência para operações de compra, venda e composição de portfólio.

## Entidades

### AssetClass
| Campo       | Tipo          | Descrição                                       |
|-------------|---------------|-------------------------------------------------|
| id          | String (cuid) | Identificador único                             |
| name        | String        | Nome da classe (ex: "Ações")                    |
| code        | String?       | Código curto único (ex: "ACOES", "FII", "ETF")  |
| description | String?       | Descrição livre                                 |
| createdAt   | DateTime      | Data de criação                                 |

### Asset
| Campo       | Tipo          | Descrição                                       |
|-------------|---------------|-------------------------------------------------|
| id          | String (cuid) | Identificador único                             |
| name        | String        | Nome completo (ex: "Petrobras PN")              |
| ticker      | String?       | Código de negociação único (ex: "PETR4")        |
| isin        | String?       | Código ISIN internacional (único)               |
| cnpj        | String?       | CNPJ do fundo (único, para FIIs/fundos)         |
| category    | AssetCategory | Categoria do ativo (enum)                       |
| assetClassId| String        | FK para AssetClass                              |
| createdAt   | DateTime      | Data de criação                                 |

## Enum: AssetCategory

| Valor        | Descrição                          |
|--------------|------------------------------------|
| STOCK        | Ação de empresa listada             |
| FII          | Fundo de investimento imobiliário   |
| ETF          | Exchange Traded Fund                |
| FIXED_INCOME | Renda fixa (Tesouro, CDB, LCI…)    |
| FUND         | Fundo de investimento aberto        |
| CRYPTO       | Criptomoeda                        |
| METAL        | Metal precioso (ouro, prata…)       |
| REAL_ESTATE  | Imóvel direto                      |
| CASH         | Caixa e equivalentes               |

## Invariantes

- `ticker`, `isin` e `cnpj` são únicos quando preenchidos (um ativo não pode ter dois registros com mesmo ticker).
- `assetClassId` é obrigatório — todo ativo pertence a uma classe.
- `AssetClass.code` é único quando preenchido.
- Assets são imutáveis em produção (não deletar; usar soft-delete futuramente).

## Serviços

| Função                         | Arquivo    | Descrição                                    |
|--------------------------------|------------|----------------------------------------------|
| `createAssetClass(input)`      | service.ts | Cria classe de ativo                         |
| `createAsset(input)`           | service.ts | Cria ativo e retorna com classe              |
| `getAssetByTicker(ticker)`     | service.ts | Busca ativo por ticker (retorna null se N/A) |
| `getAssetsByClass(classId)`    | service.ts | Lista ativos de uma classe                   |
| `getAllAssetClasses()`          | service.ts | Lista todas as classes                       |

## Seed inicial (`prisma/seed.ts`)

Classes criadas:
- `ACOES` — Ações
- `FII` — Fundos Imobiliários
- `ETF` — ETFs
- `RF` — Renda Fixa
- `CRYPTO` — Criptomoedas
- `CASH` — Caixa e Equivalentes

Ativos iniciais: PETR4, PETR3, ITUB4, VALE3, BBDC4, ABEV3, WEGE3, MGLU3, HGLG11, KNRI11, XPML11, IFIX11, BOVA11, SMAL11, IVVB11

Rodar com: `pnpm db:seed`

## Migration

`20260408003350_assets_catalog` — Cria tabelas `AssetClass`, `Asset` e enum `AssetCategory`.

## Dependências

- Sem dependências de outros módulos (entidade raiz do catálogo)
- Futuramente referenciado por `Transaction`, `Position`, `IncomeEvent`

## Próximos passos

- Criar `AssetIdentifier` (Épico 1.3 do plano) para múltiplos códigos por ativo
- Adicionar `updateAsset()` e soft-delete
- Relacionar com `Transaction` no Épico 1.4
