# Módulo: Accounts (Contas)

## Objetivo

Gerenciar contas financeiras associadas a portfólios. Uma conta representa um vínculo entre um portfólio e uma instituição financeira, classificado por tipo.

## Entidades

### Account
| Campo         | Tipo           | Descrição                                 |
|---------------|----------------|-------------------------------------------|
| id            | String (cuid)  | Identificador único                       |
| name          | String         | Nome da conta (ex: "XP Renda Variável")   |
| type          | AccountType    | Tipo da conta (enum)                      |
| portfolioId   | String         | FK para Portfolio                         |
| institutionId | String?        | FK opcional para Institution              |
| createdAt     | DateTime       | Data de criação                           |

### Institution
| Campo     | Tipo            | Descrição                           |
|-----------|-----------------|-------------------------------------|
| id        | String (cuid)   | Identificador único                 |
| name      | String          | Nome da instituição                 |
| type      | InstitutionType?| Tipo (enum, opcional)               |
| createdAt | DateTime        | Data de criação                     |

## Enums

### AccountType
- `BROKERAGE` — Corretora de valores
- `BANK` — Conta bancária
- `CRYPTO_WALLET` — Carteira de criptomoedas
- `REAL_ESTATE` — Imóvel ou fundo imobiliário
- `MANUAL` — Conta de controle manual

### InstitutionType
- `BROKER` — Corretora
- `BANK` — Banco
- `CRYPTO_EXCHANGE` — Exchange de cripto
- `REAL_ESTATE_FUND` — Fundo imobiliário
- `OTHER` — Outro tipo

## Invariantes

- Toda conta deve estar associada a um Portfolio existente.
- `institutionId` é opcional — contas podem existir sem instituição cadastrada.
- `AccountType` é obrigatório e imutável após criação (alteração exige nova migration e decisão).

## Serviços disponíveis

| Função                       | Arquivo         | Descrição                              |
|------------------------------|-----------------|----------------------------------------|
| `createAccount(input)`       | service.ts      | Cria conta e retorna com relações      |
| `getAccountsByPortfolio(id)` | service.ts      | Lista contas de um portfólio           |

## Dependências

- `Portfolio` (já existente) — relação obrigatória
- `Institution` — entidade deste módulo, relação opcional com Account

## Migration

`20260408002729_institutions_accounts` — Cria tabelas `Institution`, `Account` e enums `AccountType`, `InstitutionType`.

## Próximos passos

- Adicionar `updateAccount()` e `deleteAccount()`
- Criar relação `Account → Transaction` (Épico 1.4 do plano)
- Adicionar CRUD de Institution com validação de duplicidade por nome
