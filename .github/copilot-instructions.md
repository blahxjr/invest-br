# Instruções Locais Copilot

Stack: Next.js + Prisma 7 + PostgreSQL investbr
Estrutura: src/modules/* | docs/modules/* | memory/*
Banco: postgres:postgres@localhost:5432/investbr

COMANDOS PRONTO:
pnpm dev
npx prisma studio  
npx prisma migrate dev --name NOME
pnpm test
pnpm db:seed

FLUXO: Orchestrator → Planner → Implementer → Reviewer → Documenter → Memory
