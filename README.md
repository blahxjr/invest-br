![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange?style=for-the-badge)

# 💹 invest-br

Plataforma web full-stack para investidores brasileiros acompanharem carteira, operações e indicadores financeiros com base em dados confiáveis.

O invest-br é um sistema de gestão de investimentos focado no contexto do mercado brasileiro, com suporte para ações da B3, FIIs, renda fixa e outros ativos.
A aplicação combina App Router do Next.js com backend integrado para autenticação, importação de planilhas, cálculo de posição e monitoramento de rebalanceamento.
O projeto prioriza rastreabilidade financeira com ledger, precisão numérica com Decimal e validação de dados em camadas de serviço.
A arquitetura foi organizada para facilitar evolução contínua, testes automatizados e colaboração em fluxo open-source.

## Sumário

- [✨ Funcionalidades](#-funcionalidades)
- [🚀 Tech Stack](#-tech-stack)
- [📋 Pré-requisitos](#-pré-requisitos)
- [⚙️ Instalação e Configuração](#️-instalação-e-configuração)
- [🗄️ Banco de Dados](#️-banco-de-dados)
- [🧪 Testes](#-testes)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [🤖 Agentes de IA](#-agentes-de-ia)
- [🔐 Variáveis de Ambiente](#-variáveis-de-ambiente)
- [🚢 Deploy](#-deploy)
- [📖 Uso da API](#-uso-da-api)
- [🤝 Contribuição](#-contribuição)
- [📄 Licença](#-licença)
- [📞 Contato e Suporte](#-contato-e-suporte)
- [🔗 Links Úteis](#-links-úteis)

## ✨ Funcionalidades

### Autenticação

- ☑️ Autenticação segura com NextAuth v5 (beta), sessões em banco e proteção de rotas por middleware
- ☑️ Fluxo de acesso por e-mail com provider Nodemailer e páginas dedicadas de login/verificação
- ☑️ Controle de sessão com user.id disponível para escopo de dados por usuário

### Carteira

- ☑️ Gestão de carteira com módulos de contas, instituições, ativos e movimentações financeiras
- ☑️ Suporte a classes de ativos brasileiras (ações, FIIs, renda fixa e categorias correlatas)
- ☑️ Registro de operações em ledger com rastreabilidade por referência/idempotência
- ☑️ Cálculos financeiros de precisão para preço médio, posição e consolidação de patrimônio

### Dashboard

- ☑️ Dashboard com indicadores de patrimônio e composição de alocação
- ☑️ Gráficos interativos com Recharts para visualização de distribuição e evolução
- ☑️ Insights de rebalanceamento com alertas de concentração e desalinhamento

### Relatórios

- ☑️ Relatórios e histórico de operações com páginas dedicadas para transações, renda e performance
- ☑️ Importação de planilhas Excel (XLSX) para negociação, movimentação e posição
- ☑️ Exportação/importação orientada para workflows de corretoras e conciliação
- ☑️ Base pronta para agentes de IA com memória contextual para análise e suporte operacional

## 🚀 Tech Stack

| Tecnologia | Versão | Finalidade |
|---|---|---|
| Next.js (App Router) | 16 | Framework full-stack React para rotas, renderização e server actions |
| React | 19 | Biblioteca de UI para componentes cliente e server components |
| TypeScript | 6 | Tipagem estática e segurança de contratos no frontend e backend |
| Prisma ORM | 7 | Modelagem e acesso ao banco com client tipado |
| @prisma/adapter-pg | 7 | Adapter exigido pelo Prisma 7 para PostgreSQL |
| PostgreSQL (pg) | 8 (driver) | Banco relacional principal para dados transacionais e autenticação |
| NextAuth | v5 beta | Autenticação, sessões e handlers para rotas /api/auth |
| @auth/prisma-adapter | 2 | Persistência de usuários/sessões/tokens do NextAuth no PostgreSQL |
| Tailwind CSS | v4 | Estilização utilitária no frontend |
| Recharts | 3 | Gráficos e visualizações de dashboard/insights |
| Zod | 4 | Validação de payloads e schemas em server actions e serviços |
| XLSX | 0.18 | Leitura de planilhas para importação de dados B3 |
| Nodemailer | 7 | Envio de e-mails no fluxo de autenticação |
| Decimal.js | 10 | Operações financeiras com precisão decimal |
| Vitest | 4 | Runner de testes unitários e integração |
| @testing-library/react | 16 | Testes de componentes e comportamento de UI |
| pnpm | 9+ | Gerenciador de pacotes e execução de scripts |

## 📋 Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 14
- Git

Verificações rápidas recomendadas:

```bash
# Verifica versão do Node.js
node -v

# Verifica versão do pnpm
pnpm -v

# Verifica se o PostgreSQL está acessível
psql --version

# Verifica Git instalado
git --version
```

## ⚙️ Instalação e Configuração

1. Clone o repositório

```bash
# Clona o projeto
git clone https://github.com/blahxjr/invest-br.git

# Entra na pasta do projeto
cd invest-br
```

2. Instale as dependências

```bash
# Instala pacotes de dependências e desenvolvimento
pnpm install
```

3. Configure as variáveis de ambiente

```bash
# Cria o arquivo local de variáveis a partir do exemplo
cp .env.local.example .env.local

# Edite o arquivo .env.local com os dados reais do seu ambiente
# (use seu editor preferido)
```

4. Aplique as migrations do Prisma

```bash
# Gera/aplica migrações no banco configurado em DATABASE_URL
pnpm prisma migrate dev
```

5. Popule o banco com dados iniciais

```bash
# Executa seed padrão do projeto
pnpm db:seed
```

6. Inicie o servidor de desenvolvimento

```bash
# Sobe aplicação local em http://localhost:3000
pnpm dev
```

7. (Opcional) Limpe dados de importação para testes de reprocessamento

```bash
# Limpa dados de importação (mantém usuário, cliente e carteira)
pnpm db:reset-import

# Executa sem confirmação interativa
pnpm db:reset-import -- --force
```

## 🗄️ Banco de Dados

### ERD em texto (visão resumida)

```text
User (1) ──< Client (N)
User (1) ──< Portfolio (N)
User (1) ──< Session (N)
User (1) ──< AuthAccount (N)
User (1) ──< AllocationTarget (N)

Client (1) ──< Account (N)
Portfolio (0..1) ──< Account (N)
Institution (1) ──< Account (N)

AssetClass (1) ──< Asset (N)
Account (1) ──< Transaction (N)
Asset (0..1) ──< Transaction (N)
Transaction (1) ──< LedgerEntry (N)
Account (1) ──< LedgerEntry (N)

Account (1) ──< IncomeEvent (N)
Asset (0..1) ──< IncomeEvent (N)
Transaction (0..1) ──< IncomeEvent (N)

Account (1) ──< RentalReceipt (N)

InsightConfigProfile (1) ──< InsightConfigRule (N)
InsightType (1) ──< InsightConfigRule (N)

AuditLog registra alterações de entidades relevantes
(TRANSACTION, INCOME e eventos de importação)
```

### Comandos Prisma mais usados

```bash
# Gera cliente Prisma após alterações de schema
pnpm prisma generate

# Aplica migration em desenvolvimento
pnpm prisma migrate dev

# Cria migration sem aplicar automaticamente
pnpm prisma migrate dev --create-only

# Abre Prisma Studio para inspeção do banco
pnpm prisma studio

# Executa seed
pnpm db:seed
```

### Seed do projeto

```bash
# Seed oficial do repositório
pnpm db:seed
```

O seed utiliza arquivo em prisma/seed.ts e prepara dados iniciais para desenvolvimento local.

## 🧪 Testes

### Execução dos testes

```bash
# Executa toda a suíte de testes uma vez
pnpm test

# Executa em modo watch para desenvolvimento
pnpm test:watch
```

### Estrutura de testes

```text
__tests__/
├── components/        # Testes de componentes React (UI e interação)
├── modules/           # Testes de serviços de domínio e regras financeiras
├── lib/               # Testes de utilitários e integrações internas
├── helpers/           # Fixtures e utilidades de teste
├── setup.ts           # Setup global de testes
└── setup.components.ts# Setup para testes de componentes
```

### Cobertura esperada

- Cobrir cenários críticos de domínio financeiro: criação de transações, ledger e idempotência
- Cobrir fluxos de importação: análise, confirmação e persistência
- Cobrir autenticação e autorização em rotas protegidas
- Cobrir comportamento de UI em componentes de páginas principais
- Meta recomendada para módulos críticos: cobertura funcional consistente com foco em regressões

Exemplo de execução pontual:

```bash
# Roda apenas testes do fluxo de importação
pnpm vitest run __tests__/components/ImportPageClient.test.tsx __tests__/modules/b3/reset-service.test.ts
```

## 📁 Estrutura do Projeto

```text
invest-br/
├── src/                                # Código-fonte principal
│   ├── app/                            # Rotas e páginas (Next.js App Router)
│   │   ├── (app)/                      # Área autenticada
│   │   ├── api/                        # Endpoints HTTP (route handlers)
│   │   ├── login/                      # Páginas públicas de autenticação
│   │   ├── layout.tsx                  # Layout raiz
│   │   └── globals.css                 # Estilos globais (Tailwind v4)
│   ├── modules/                        # Regras de negócio por domínio
│   │   ├── accounts/                   # Gestão de contas
│   │   ├── assets/                     # Catálogo de ativos
│   │   ├── b3/                         # Importação/análise de planilhas B3
│   │   ├── income/                     # Proventos e rendimentos
│   │   ├── insights/                   # Rebalanceamento e alertas
│   │   ├── institutions/               # Instituições financeiras
│   │   ├── positions/                  # Cálculo de posições e histórico
│   │   └── transactions/               # Transações e ledger
│   ├── lib/                            # Configurações compartilhadas (auth/prisma)
│   └── types/                          # Tipos globais (ex.: NextAuth)
├── prisma/                             # Schema, migrations e seed
│   ├── schema.prisma                   # Modelo de dados
│   ├── seed.ts                         # Script de seed
│   └── migrations/                     # Histórico de migrations
├── scripts/                            # Scripts utilitários (reset/import helpers)
├── __tests__/                          # Testes automatizados
├── docs/                               # Documentação de arquitetura e decisões
├── memory/                             # Memória de projeto para agentes de IA
├── projeto/                            # Materiais de planejamento e organização
├── public/                             # Arquivos estáticos
├── middleware.ts                       # Proteção de rotas com NextAuth
├── prisma.config.ts                    # Configuração Prisma 7
├── package.json                        # Scripts e dependências
└── .env.local                          # Variáveis locais (não versionar)
```

### Padrões técnicos seguidos

- App Router com organização por segmentos e layouts
- Server Components por padrão nas páginas do app
- Server Actions para mutações e fluxos de upload/importação
- Separação de domínio em src/modules para evitar regra de negócio em componentes
- Prisma Client centralizado em src/lib/prisma.ts com adapter @prisma/adapter-pg
- Autenticação centralizada em src/lib/auth.ts e middleware.ts

## 🤖 Agentes de IA

O projeto mantém um fluxo de agentes de IA para planejamento, implementação, revisão e documentação de funcionalidades financeiras.

### Como funciona

- Agentes especializados atuam por contexto (orquestração, implementação, testes, segurança, documentação)
- O estado do projeto é registrado em arquivos de memória para continuidade de contexto
- As decisões técnicas e arquiteturais são versionadas em documentos de apoio

### Interação com o sistema financeiro

- Agentes apoiam análise de regras de negócio para importação e cálculos de carteira
- Agentes auxiliam validação de consistência entre transações, ledger e posições
- Agentes apoiam geração de documentação e checklist de qualidade para mudanças críticas

### Arquivos relevantes

- memory/
- plano_agents_investimentos_brasil.md
- memory/current-state.md
- memory/decisions.md
- docs/decisions/
- .github/agents/

## 🔐 Variáveis de Ambiente

### Tabela de variáveis

| Variável | Obrigatória | Descrição | Exemplo |
|---|---|---|---|
| DATABASE_URL | Sim | String de conexão PostgreSQL usada por Prisma e aplicação | postgresql://user:password@host:5432/invest_br |
| NEXTAUTH_SECRET | Sim | Chave secreta para assinatura e segurança das sessões | sua_chave_secreta_aqui |
| NEXTAUTH_URL | Sim | URL base da aplicação para callbacks de autenticação | http://localhost:3000 |
| EMAIL_SERVER_HOST | Sim | Host SMTP para envio de e-mails de autenticação/notificação | smtp.exemplo.com |
| EMAIL_SERVER_PORT | Sim | Porta SMTP | 587 |
| EMAIL_SERVER_USER | Sim | Usuário da conta SMTP | seu@email.com |
| EMAIL_SERVER_PASSWORD | Sim | Senha/token da conta SMTP | senha_email |
| EMAIL_FROM | Sim | Endereço remetente padrão dos e-mails | noreply@invest-br.com |

### Exemplo pronto

Arquivo de exemplo versionado:

- [.env.local.example](.env.local.example)

Conteúdo esperado:

```env
DATABASE_URL=postgresql://user:password@host:5432/invest_br
NEXTAUTH_SECRET=sua_chave_secreta_aqui
NEXTAUTH_URL=http://localhost:3000
EMAIL_SERVER_HOST=smtp.exemplo.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=seu@email.com
EMAIL_SERVER_PASSWORD=senha_email
EMAIL_FROM=noreply@invest-br.com
```

## 🚢 Deploy

Deploy recomendado: Railway.

### 1) Preparar banco PostgreSQL

- Crie um serviço PostgreSQL no Railway
- Copie a connection string para DATABASE_URL

### 2) Configurar variáveis de ambiente

Defina no painel do Railway:

- DATABASE_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- EMAIL_SERVER_HOST
- EMAIL_SERVER_PORT
- EMAIL_SERVER_USER
- EMAIL_SERVER_PASSWORD
- EMAIL_FROM

### 3) Comandos de build e start

```bash
# Build de produção
pnpm build

# Inicialização em produção
pnpm start
```

### 4) Pós-deploy (migrations/seed)

```bash
# Aplicar migrations no ambiente de deploy
pnpm prisma migrate deploy

# (Opcional) Popular dados iniciais
pnpm db:seed
```

### 5) Checklist de produção

- Validar NEXTAUTH_URL com domínio público real
- Validar SMTP com TLS e credenciais seguras
- Habilitar logs de aplicação e monitoramento de erros
- Revisar políticas de backup do banco

## 📖 Uso da API

O projeto expõe handlers HTTP em src/app/api.

### Endpoints principais

| Método | Endpoint | Descrição | Auth |
|---|---|---|---|
| GET, POST | /api/auth/[...nextauth] | Handlers do NextAuth (signin/session/callbacks) | Dependente da rota interna do NextAuth |
| GET | /api/insights/rebalance | Retorna análise de rebalanceamento e alertas do usuário logado | Obrigatória |

### Exemplo: GET /api/insights/rebalance

Request:

```http
GET /api/insights/rebalance HTTP/1.1
Host: localhost:3000
Cookie: next-auth.session-token=...
```

Response 200 (resumo):

```json
{
  "rebalance": {
    "totalPortfolioValue": "150000.00",
    "allocations": [
      {
        "assetClass": "ACOES",
        "label": "Ações",
        "currentValue": "60000.00",
        "currentPct": "40.00",
        "targetPct": "35.00",
        "deviationPct": "5.00",
        "status": "ACIMA",
        "suggestionValue": "-7500.00",
        "suggestionLabel": "Reduzir"
      }
    ],
    "isBalanced": false,
    "lastUpdated": "2026-04-16T10:00:00.000Z"
  },
  "alerts": [
    {
      "type": "CONCENTRACAO",
      "severity": "WARNING",
      "label": "Concentração elevada por ativo",
      "value": "25.00"
    }
  ],
  "disclaimer": "Esta análise é informativa e não constitui recomendação de investimento."
}
```

Response 401:

```json
{
  "error": "Não autenticado"
}
```

### Exemplo: /api/auth/[...nextauth]

Observação: este endpoint é gerenciado internamente pelo NextAuth.

Operações comuns:

- Início de login por e-mail
- Verificação de sessão atual
- Callback de autenticação
- Logout

Exemplo de chamada de sessão:

```http
GET /api/auth/session HTTP/1.1
Host: localhost:3000
```

Response (exemplo):

```json
{
  "user": {
    "id": "clx123...",
    "email": "usuario@dominio.com",
    "name": "Usuário"
  },
  "expires": "2026-04-17T12:00:00.000Z"
}
```

### Autenticação nas rotas

- A área em src/app/(app) é protegida por middleware.ts
- Requisições sem sessão válida recebem redirecionamento para /login em páginas web
- Endpoints API privados retornam erro 401 quando não autenticado

## 🤝 Contribuição

### Fluxo recomendado

1. Faça um fork do repositório
2. Crie uma branch de feature/fix
3. Implemente a mudança com testes
4. Faça commit seguindo Conventional Commits
5. Abra um Pull Request com descrição clara

### Padrão de commits

Formato recomendado:

```text
tipo(escopo): descrição em pt-BR
```

Exemplos:

```text
feat(transactions): adicionar validação de idempotência
fix(import): corrigir normalização de instituição
docs(readme): atualizar seção de deploy
test(insights): cobrir regra de alerta crítico
```

### Code style

- TypeScript em modo strict
- Organização por domínio em src/modules
- Preferir Server Components e Server Actions quando aplicável
- Validar entradas com Zod
- Manter estilo consistente e lint local (ESLint/boas práticas TS)

### Checklist mínimo para PR

- Alteração funcional implementada
- Testes relevantes atualizados/adicionados
- Documentação atualizada quando necessário
- Sem vazamento de segredos ou credenciais

## 📄 Licença

Distribuído sob a licença MIT.

Consulte o arquivo LICENSE quando disponível no repositório para o texto completo da licença.

Créditos:

- Autor: blahxjr
- Projeto: invest-br

## 📞 Contato e Suporte

- Para reportar bugs, utilize GitHub Issues
- Para dúvidas e discussões técnicas, utilize GitHub Discussions
- Para melhoria de documentação, abra issue com label docs

## 🔗 Links Úteis

- Repositório: https://github.com/blahxjr/invest-br
- Issues: https://github.com/blahxjr/invest-br/issues
- Discussions: https://github.com/blahxjr/invest-br/discussions
- Prisma: https://www.prisma.io/docs
- Next.js: https://nextjs.org/docs
- NextAuth: https://authjs.dev
- Tailwind CSS: https://tailwindcss.com/docs
- Vitest: https://vitest.dev
