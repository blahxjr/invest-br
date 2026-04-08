# Decisões técnicas

**Última atualização:** 2026-04-08

## DEC-001 — Prisma 7 requer driver adapter

**Contexto:** Prisma 7 removeu o engine binário nativo. `PrismaClient` sem adapter lança `PrismaClientConstructorValidationError`.
**Decisão:** Usar `@prisma/adapter-pg` + `pg` para conexão direta local. `Pool` do `pg` recebe `DATABASE_URL` de `.env.local`.
**Consequência:** Todo ambiente (dev, test, prod) precisa do adapter configurado.

## DEC-002 — URL de conexão em prisma.config.ts, não no schema

**Contexto:** Prisma 7 removeu suporte a `url = env(...)` no bloco `datasource` do `schema.prisma`.
**Decisão:** `DATABASE_URL` configurada exclusivamente em `prisma.config.ts` via `env('DATABASE_URL')` de `prisma/config`.
**Consequência:** `prisma.config.ts` é o único ponto de verdade para a connection string no Prisma CLI.

## DEC-003 — .env.local tem prioridade sobre .env

**Contexto:** `.env` gerado pelo Prisma init com credenciais placeholder. `.env.local` com credenciais reais do ambiente de desenvolvimento.
**Decisão:** `dotenv` carrega `.env.local` primeiro com `override: true`, depois `.env` como fallback.
**Consequência:** Nunca commitar `.env.local`. Manter `.env` apenas como exemplo/documentação.

## DEC-008 — Next.js 16 + Prisma em Server Components

**Contexto:** Next.js 16 tenta fazer bundle do Prisma Client e adapters junto ao código do servidor. O `PrismaClient` com driver adapter não funciona corretamente quando bundled pelo Next.
**Decisão:** Adicionar `serverComponentsExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg']` no `next.config.ts`.
**Consequência:** O Prisma Client roda no runtime Node.js do servidor, não bundled.

## DEC-009 — Tailwind CSS v4 sem tailwind.config.js

**Contexto:** Tailwind v4 mudou o modelo de configuração — não usa mais `tailwind.config.js`. O conteúdo é detectado automaticamente (CSS-first config).
**Decisão:** Usar apenas `@import "tailwindcss"` no `globals.css` e `@tailwindcss/postcss` como plugin PostCSS.
**Consequência:** Sem arquivo de config Tailwind. Customizações via `@theme` no CSS quando necessário.

## DEC-010 — vitest jsdom por arquivo (não por glob)

**Contexto:** O `environmentMatchGlobs` do vitest não sobrepõe o `environment: 'node'` global de forma confiável nesta versão.
**Decisão:** Adicionar `// @vitest-environment jsdom` no topo de cada arquivo de teste de componente React.
**Consequência:** Cada arquivo de componente declara seu próprio ambiente. Mais explícito e confiável.


**Contexto:** Prisma 7 não expõe `@prisma/client/runtime/library` como módulo importável diretamente.
**Decisão:** `import { Decimal } from '@prisma/client'` — exportado diretamente do pacote principal.
**Consequência:** Todo código que usa `Decimal` deve importar de `@prisma/client`, nunca do runtime interno.

**Contexto:** Prisma não permite modelo e enum com o mesmo nome. O objetivo definia `AssetClass` como enum E como model.
**Decisão:** Enum nomeado `AssetCategory` (valores: STOCK, FII, ETF…); model nomeado `AssetClass` (representa a categoria administrativa com nome/código/descrição). Campo `category` em `Asset` usa `AssetCategory`.
**Consequência:** Queries de ativo filtram por `category` (enum direto) ou por `assetClassId` (relação com o model). Ambos os eixos estão disponíveis.

## DEC-011 — Magic link via Nodemailer (sem senhas)

**Contexto:** Fase 5 adicionou autenticação ao sistema. Escolher entre OAuth, credenciais (login/senha) e magic link.
**Decisão:** Nodemailer provider do NextAuth — usuário informa e-mail e recebe link único de acesso.
**Consequência:** Sem armazenamento de senhas. Dependência de servidor SMTP em produção. UX simples e segura.

## DEC-012 — Estratégia de sessão: database (não JWT)

**Contexto:** NextAuth suporta sessões JWT (stateless) ou database (stateful). JWT é mais simples mas não permite revogação imediata.
**Decisão:** `session: { strategy: 'database' }` — tokens de sessão persistidos na tabela `Session` via PrismaAdapter.
**Consequência:** Sessões podem ser revogadas. Requer acesso ao banco em cada request. Tabelas `AuthAccount`, `Session`, `VerificationToken` adicionadas ao schema.

## DEC-013 — user.id na sessão via session callback

**Contexto:** Por padrão, NextAuth v5 não expõe `user.id` na sessão do cliente/Server Components.
**Decisão:** Adicionar callback `session({ session, user }) { session.user.id = user.id }` em `auth.ts`.
**Consequência:** `session.user.id` disponível em todos os Server Components e Server Actions para filtrar dados por usuário. Tipo aumentado em `src/types/next-auth.d.ts`.
