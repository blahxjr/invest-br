# Decisões técnicas

**Última atualização:** 2026-04-07

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

## DEC-006 — Decimal importado de @prisma/client

**Contexto:** Prisma 7 não expõe `@prisma/client/runtime/library` como módulo importável diretamente.
**Decisão:** `import { Decimal } from '@prisma/client'` — exportado diretamente do pacote principal.
**Consequência:** Todo código que usa `Decimal` deve importar de `@prisma/client`, nunca do runtime interno.

**Contexto:** Prisma não permite modelo e enum com o mesmo nome. O objetivo definia `AssetClass` como enum E como model.
**Decisão:** Enum nomeado `AssetCategory` (valores: STOCK, FII, ETF…); model nomeado `AssetClass` (representa a categoria administrativa com nome/código/descrição). Campo `category` em `Asset` usa `AssetCategory`.
**Consequência:** Queries de ativo filtram por `category` (enum direto) ou por `assetClassId` (relação com o model). Ambos os eixos estão disponíveis.
