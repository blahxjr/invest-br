# Módulo: Accounts (Contas)

## Objetivo

Gerenciar o fluxo de cadastro de Instituições e Contas no domínio de Cadastro, incluindo criação, listagem e atualização com validações de vínculo e escopo.

## Entidades

### Account
| Campo         | Tipo           | Descrição                                 |
|---------------|----------------|-------------------------------------------|
| id            | String (cuid)  | Identificador único                       |
| name          | String         | Nome da conta (ex: "XP Renda Variável")   |
| type          | AccountType    | Tipo da conta (enum)                      |
| clientId      | String         | FK obrigatória para Client                |
| institutionId | String         | FK obrigatória para Institution           |
| portfolioId   | String?        | FK opcional para Portfolio                |
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

- Toda conta deve estar associada a um `Client` existente.
- Toda conta deve estar associada a uma `Institution` existente.
- `portfolioId` é opcional; quando informado, deve pertencer ao mesmo usuário do `Client` vinculado.
- `name` não pode ser vazio após sanitização por trim.
- `AccountType` é obrigatório.

## Serviços disponíveis

| Função                       | Arquivo         | Descrição                              |
|------------------------------|-----------------|----------------------------------------|
| `createAccount(input)`       | service.ts      | Cria conta com validação de vínculos Client/Institution/Portfolio |
| `getAccountsByPortfolio(id)` | service.ts      | Lista contas de um portfólio           |
| `getAccountsByClient(id)`    | service.ts      | Lista contas por client                |
| `updateAccount(id, input)`   | service.ts      | Atualiza nome, instituição e/ou portfolio com validação de escopo |

## Serviços de Institution no fluxo de cadastro

| Função                         | Arquivo         | Descrição                              |
|--------------------------------|-----------------|----------------------------------------|
| `createInstitution(input)`     | service.ts      | Cria instituição com validação de nome/tipo e duplicidade case-insensitive |
| `listInstitutions()`           | service.ts      | Lista instituições ordenadas por nome  |
| `updateInstitution(id, input)` | service.ts      | Atualiza instituição com validações de nome/tipo e duplicidade |

## Fluxo de Cadastro na aplicação

- A tela `accounts/new` resolve a instituição por `institutionId` selecionado ou por `institutionName` informado.
- Se o usuário ainda não possuir `Client`, o fluxo cria/reutiliza um client principal antes de criar a conta.
- Se o usuário ainda não possuir `Portfolio`, o fluxo cria uma carteira padrão (`Minha Carteira`).
- A criação final da conta sempre passa por `createAccount()` do módulo.

## Dependências

- `Client` — relação obrigatória para `Account`
- `Institution` — relação obrigatória para `Account`
- `Portfolio` — relação opcional para `Account` (com validação de escopo por usuário)

## Migration

`20260408002729_institutions_accounts` — Cria tabelas `Institution`, `Account` e enums `AccountType`, `InstitutionType`.

`20260409120000_add_client_and_account_constraints` — Ajusta vínculos e restrições para o fluxo atual de cadastro.

## Próximos passos

- Adicionar `deleteAccount()` com política de segurança para contas já movimentadas.
- Evoluir o relacionamento de conta/carteira para cenários multi-carteira mais avançados.
