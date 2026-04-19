# Instruções Globais para o GitHub Copilot — Projeto invest-br

> Este arquivo é lido automaticamente pelo GitHub Copilot Chat ao usar `@workspace`.
> Ele define o contexto, regras, papéis dos agentes e modelo recomendado para cada tarefa.
> **Idioma padrão: Português do Brasil (pt-BR)** em comentários, documentação e mensagens de commit.

---

## 1. Visão geral do projeto

**Nome**: invest-br  
**Objetivo**: Sistema de gerenciamento de investimentos para o investidor brasileiro — consolidação patrimonial, ledger rastreável, proventos, importação de extratos e dashboard.  
**Inspiração arquitetural**: Wealthfolio, reposicionado para stack web-first com Next.js, TypeScript e PostgreSQL.  
**Foco da V1**: Ledger confiável, posição por ativo, recebimentos, dashboard e importação de CSV.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.2 (App Router) + TypeScript |
| UI | TailwindCSS 4.2.2 (sem tailwind.config.js — CSS-first) |
| ORM | Prisma 7.7.0 + `@prisma/adapter-pg` + `pg` |
| Banco | PostgreSQL (banco: `investbr`, localhost:5432) |
| Auth | NextAuth v5 (magic link Nodemailer, database sessions, PrismaAdapter) |
| Testes | Vitest 4.1.3 + tsx + @testing-library/react (jsdom) |
| Package manager | pnpm |
| Path alias | `@/*` → `./src/*` |

---

## 3. Arquivos de contexto obrigatórios

Antes de propor qualquer mudança arquitetural ou de domínio, consulte sempre:

- `#file:'memory/current-state.md'` — Estado atual completo: entidades, módulos, testes, pendências
- `#file:'memory/decisions.md'` — Decisões técnicas vigentes (DEC-001 a DEC-013, ADR-001)
- `#file:'docs/decisions/ADR-001-ledger-model.md'` — Modelo de ledger adotado
- `#file:'prisma/schema.prisma'` — Schema atual do banco
- `#file:'.github/agents/orchestrator.md'` — Regras do Orchestrator Agent

---

## 4. Estrutura de módulos

```
src/
├── app/               ← rotas Next.js (App Router)
│   ├── (app)/         ← rotas protegidas (requerem sessão)
│   ├── login/         ← área pública
│   └── api/auth/      ← NextAuth handler
├── components/        ← componentes React reutilizáveis
│   ├── ui/            ← componentes genéricos
│   ├── charts/        ← gráficos
│   ├── cards/         ← cards de domínio
│   ├── tables/        ← tabelas
│   └── layout/        ← layout (Sidebar, Header)
├── modules/           ← domínio por módulo
│   ├── accounts/      ← contas (createAccount, getAccountsByPortfolio)
│   ├── assets/        ← ativos (createAsset, getAssetByTicker, getAllAssetClasses)
│   ├── transactions/  ← ledger (createTransaction idempotente, getAccountBalance)
│   └── income/        ← proventos (createIncomeEvent, calculatePositionByAsset)
├── lib/
│   ├── prisma.ts      ← singleton PrismaClient com adapter
│   └── auth.ts        ← config NextAuth v5
└── types/             ← tipos globais (next-auth.d.ts)
```

---

## 5. Regras globais de desenvolvimento

### 5.1 Código
- Toda função de serviço deve ter JSDoc em pt-BR.
- Nomes de variáveis e funções em inglês; nomes de domínio financeiro podem ser em pt-BR.
- Nunca escreva lógica de negócio em Server Actions — delegue para `modules/`.
- Nunca acesse `prisma` diretamente em componentes — use sempre serviços em `modules/`.
- Toda entrada de dados do usuário deve ser validada antes de chegar ao service.
- Nunca exponha stack trace em respostas de API ou Server Actions.

### 5.2 Domínio financeiro
- **Ledger**: toda movimentação gera `Transaction` + `LedgerEntry`. Nunca modifique saldo diretamente.
- **Idempotência**: `createTransaction()` usa `referenceId` único — nunca processe duplicatas.
- **Custo médio**: SELL mantém custo médio, apenas reduz quantidade (DEC-007).
- **Decimal**: sempre use `Decimal` de `@prisma/client`, nunca `float` para valores financeiros.
- **Enums distintos**: `AssetCategory` (enum) ≠ `AssetClass` (model) — ver DEC-005.

### 5.3 Auth e sessão
- Toda rota em `(app)/` é protegida pelo middleware (`middleware.ts`).
- Use `const session = await auth()` em Server Components e Server Actions.
- `session.user.id` está disponível via session callback (DEC-013).
- Estratégia: `database` sessions — permite revogar (DEC-012).

### 5.4 Prisma e banco
- Prisma 7 requer `@prisma/adapter-pg` — nunca instanciar `PrismaClient` sem adapter (DEC-001).
- `DATABASE_URL` vem de `.env.local` (prioridade) — nunca hardcode (DEC-003).
- Next.js 16 requer `serverExternalPackages` para Prisma em Server Components (DEC-008).
- Tailwind v4: usar `@import "tailwindcss"` no CSS — sem `tailwind.config.js` (DEC-009).

### 5.5 Testes
- Testes de módulo: Vitest com banco real (`.env.local`).
- Testes de componente: adicionar `// @vitest-environment jsdom` no topo do arquivo (DEC-010).
- Nunca use `float` em asserções de valores financeiros — use `Decimal` ou compare strings.

### 5.6 Git e commits
- Formato: `tipo(escopo): descrição em pt-BR`
- Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `security`
- Exemplos: `feat(transactions): adicionar cálculo de custo médio ponderado`
- Uma feature por branch: `feat/nome-da-feature` ou `fix/nome-do-bug`
- Política mandatória: toda alteração implementada deve terminar com `git commit` e `git push` para o branch atual, enviando as mudanças ao GitHub.
- Em caso de falha de teste, conflito, ausência de permissão de push ou erro de rede, o agente deve tentar resolver automaticamente; se não for possível, deve registrar o bloqueio de forma objetiva e solicitar orientação.
- Não deixar alterações implementadas apenas localmente sem tentativa explícita de push na mesma execução da tarefa.

---

## 6. Agentes de IA disponíveis

Este projeto usa agentes especializados por contexto. Cada agente tem arquivo próprio em `.github/agents/`.

**Como ativar**: `@workspace #file:'.github/agents/NOME.md' [descreva a tarefa]`

### Agentes de Processo (fluxo de desenvolvimento)

| Agente | Arquivo | Quando usar |
|---|---|---|
| Orchestrator | `.github/agents/orchestrator.md` | Entrada de qualquer demanda nova — roteia e planeja |
| Planner | `.github/agents/planner.md` | Quebrar épicos em subtarefas verificáveis |
| Implementer | `.github/agents/implementer.md` | Executar subtarefa específica de código |
| Reviewer | `.github/agents/reviewer.md` | Revisar mudança antes de commitar |
| Documenter | `.github/agents/documenter.md` | Atualizar docs, ADRs, memory/, changelog |
| Memory Manager | `.github/agents/memory-manager.md` | Recuperar ou persistir estado após tarefa |
| Arquiteto | `.github/agents/arquiteto.md` | Decisões estruturais, ADRs, refatorações |
| Segurança | `.github/agents/seguranca.md` | Revisar auth, sessões, validação, dados financeiros |
| Testes | `.github/agents/testes.md` | Gerar ou revisar testes Vitest |
| Designer UI | `.github/agents/designer-ui.md` | Criar/revisar componentes, telas, design system |

**Fluxo padrão:**
`Orchestrator → Planner → Implementer → Reviewer → Segurança → Testes → Documenter → Memory Manager`

### Agentes de Domínio Financeiro

| Agente | Arquivo | Quando usar |
|---|---|---|
| Especialista Financeiro | `.github/agents/especialista-financeiro.md` | Validar cálculos, tributação geral, custo médio |
| Fundos de Investimento | `.github/agents/fundos-investimento.md` | FICs, multimercado, come-cotas, resgate |
| Fundos Imobiliários | `.github/agents/fundos-imobiliarios.md` | FIIs, CRIs, LCIs, rendimentos, amortização |
| Criptoativos | `.github/agents/cripto.md` | Cripto, DeFi, staking, permuta, tributação |
| ETFs e BDRs | `.github/agents/etfs.md` | ETFs nacionais/internacionais, BDRs |
| Previdência Privada | `.github/agents/previdencia.md` | PGBL, VGBL, portabilidade, tabelas IR |
| Renda Fixa | `.github/agents/renda-fixa.md` | Tesouro, CDB, LCI/LCA, CRI/CRA, debêntures |

---

## 7. Modelo de IA recomendado por agente

> Selecione o modelo manualmente no Copilot Chat (`Ctrl+Alt+I` → Auto → selecione o modelo)

| Agente | Modelo recomendado | Motivo |
|---|---|---|
| Orchestrator | **Claude Sonnet 4.6** | Decisões de roteamento e decomposição |
| Planner | **Claude Sonnet 4.6** | Planejamento estruturado com dependências |
| Implementer | **Claude Sonnet 4.6** ou **GPT-4.1** | Geração de código TypeScript/Next.js |
| Reviewer | **Claude Opus 4.6** | Revisão crítica: ledger, idempotência, segurança |
| Documenter | **Claude Haiku 4.5** | Tarefa estruturada — não justifica modelo pesado |
| Memory Manager | **Claude Haiku 4.5** | Consolidação de estado — tarefa repetitiva |
| Arquiteto | **Claude Opus 4.6** | Decisões estruturais exigem raciocínio profundo |
| Segurança | **Claude Opus 4.6** | Revisão crítica exige máxima atenção |
| Testes | **Claude Sonnet 4.6** | Testes têm estrutura previsível |
| Designer UI | **Claude Sonnet 4.6** ou **GPT-4.1** | Geração de componentes TSX/Tailwind |
| Especialista Financeiro | **Claude Opus 4.6** | Validação de regras financeiras críticas |
| Fundos de Investimento | **Claude Sonnet 4.6** | Domínio estruturado e regras claras |
| Fundos Imobiliários | **Claude Sonnet 4.6** | Domínio estruturado e regras claras |
| Criptoativos | **Claude Sonnet 4.6** | Regras em evolução — Sonnet suficiente |
| ETFs e BDRs | **Claude Sonnet 4.6** | Domínio estruturado |
| Previdência Privada | **Claude Sonnet 4.6** | Tabelas e regras bem definidas |
| Renda Fixa | **Claude Opus 4.6** | Cálculos de indexadores e edge cases complexos |

---

## 8. Comandos úteis

```bash
pnpm dev                                    # dev server
npx prisma studio                           # Prisma Studio
npx prisma migrate dev --name NOME          # nova migration
pnpm test                                   # rodar todos os testes
pnpm db:seed                                # popular banco com ativos brasileiros
```

---

## 9. Estado atual resumido

- **54 testes passando** (módulos + componentes)
- **Schema completo**: User, Portfolio, Institution, Account, AssetClass, Asset, Transaction, LedgerEntry, IncomeEvent, RentalReceipt, NextAuth tables
- **Frontend**: Dashboard, Contas, Ativos, Movimentações, Nova Conta, Nova Transação
- **Auth**: Magic link (Nodemailer) + database sessions + middleware de proteção
- **Pendências abertas**: AssetIdentifier, cotações em tempo real, importação CSV, gráficos históricos

> Para detalhes completos, leia `memory/current-state.md`.
