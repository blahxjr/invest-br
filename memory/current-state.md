# Estado atual do projeto

**Última atualização:** 2026-04-12

## Stack confirmada
- Prisma ORM 7.7.0 + PostgreSQL (investbr)
- Adapter obrigatório: @prisma/adapter-pg + pg
- Next.js 16.2.2 + React 19.2.4 (App Router)
- Tailwind CSS 4.2.2 (CSS-first)
- NextAuth v5 (magic link com Nodemailer + sessions em banco)
- Vitest 4.1.3 + Testing Library (jsdom em testes de componente)
- TypeScript + alias @/*

## Módulo Cadastro: Instituições e Contas

Status: iniciado e implementado (backend, frontend e testes).

### Escopo entregue
- Cadastro de Institution com create/list/update.
- Cadastro de Account com create/list/update.
- Fluxo na tela de nova conta com resolução de institution existente ou criação sob demanda por nome.
- Vinculação automática/reuso de Client principal do usuário autenticado.
- Portfólio padrão criado sob demanda para o usuário quando inexistente.

### Contratos implementados
- src/modules/institutions/service.ts
	- createInstitution(input)
	- listInstitutions()
	- updateInstitution(id, input)
- src/modules/accounts/service.ts
	- createAccount(input)
	- getAccountsByPortfolio(portfolioId)
	- getAccountsByClient(clientId)
	- updateAccount(id, input)

### Regras de vínculo vigentes
- Account exige clientId válido.
- Account exige institutionId válido.
- Account aceita portfolioId opcional (null permitido).
- Quando portfolioId é informado, ele precisa pertencer ao mesmo user do Client da conta.

## Entidades e vínculos relevantes
- User 1-N Client
- User 1-N Portfolio
- Institution 1-N Account
- Client 1-N Account
- Portfolio 1-N Account (opcional em Account)

## Schema e migrations
- Institution e Account: migration 20260408002729_institutions_accounts
- Restrições e ajustes de vínculo: migration 20260409120000_add_client_and_account_constraints

## Testes
- __tests__/modules/institutions.test.ts cobre create/list/update com validações de nome, tipo e duplicidade.
- __tests__/modules/accounts.test.ts cobre create/list/update com regras de vínculo, escopo e cenários de erro.
- __tests__/modules/actions.test.ts cobre Server Actions de cadastro/listagem.
- Suíte estabilizada em 2026-04-12 com fixtures isoladas e cleanup idempotente.
- Helper de testes compartilhado criado em __tests__/helpers/fixtures.ts (uniqueSuffix, uniqueTicker, safeDeleteMany).
- Dependência de seed removida dos testes de módulos de transações/rendimentos e dos checks de classes em assets.
- Validação executada 3x sem flakiness:
	- npx vitest run → 96 passed, 0 failed
	- npx vitest run --maxWorkers=1 → 96 passed, 0 failed
	- npx vitest run → 96 passed, 0 failed

## Decisões ativas relacionadas
- DEC-001: Prisma 7 com adapter pg obrigatório.
- DEC-002/DEC-003: prioridade de .env.local.
- DEC-005: AssetCategory (enum) separado de AssetClass (model).
- DEC-008: Prisma externalizado no runtime Node do Next.js.
- DEC-009: Tailwind v4 sem tailwind.config.js.
- DEC-010: jsdom por arquivo nos testes de componente.
- DEC-011/DEC-012/DEC-013: arquitetura de autenticação e sessão.
- DEC-014: Account com Client e Institution obrigatórios; Portfolio opcional.
- DEC-015: Insights V1 calculados on-the-fly, sem tabela Insight persistida.

## Módulo Insights/Rebalanceamento

Status: preparação de dados iniciada.

### Escopo de preparação concluído
- Enum `InvestmentHorizon` adicionado ao schema para suportar análise de horizonte.
- `Asset` enriquecido com `currency` (default `BRL`), `country` e `recommendedHorizon`.
- `AssetClass` enriquecido com `recommendedHorizonBase` (fallback de horizonte).
- Decisão da V1 registrada: cálculo on-the-fly, sem tabela `Insight`.

### Fora de escopo nesta fase
- Sem modelo `Position` persistido.
- Sem persistência de snapshots de insight.

## Pendências abertas
- AssetIdentifier (múltiplos identificadores por ativo).
- Importação CSV com idempotência ponta a ponta.
- Cotações em tempo real e séries históricas.

## Build e Qualidade

**Última validação:** 2026-04-12  
**Build TypeScript:** ✅ Limpo — `ignoreBuildErrors` removido de next.config.ts  
**Testes:** ✅ 96 passed, 0 failed  
**Documentação SMTP:** ✅ Alinhada — variável correta é EMAIL_SERVER_PASSWORD

