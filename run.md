# Como rodar o invest-br localmente

Este guia descreve o setup minimo para executar o sistema em ambiente local (Linux/macOS/WSL).

## 1) Pre-requisitos

- Node.js 20+
- pnpm instalado globalmente
- PostgreSQL em execucao (porta padrao 5432)

## 2) Banco de dados

Crie o banco `investbr`:

```bash
createdb investbr
```

Se preferir, use seu cliente SQL e crie manualmente o database com esse nome.

## 3) Variaveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com:

```env
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/investbr
AUTH_SECRET=sua_chave_bem_grande_e_aleatoria
BRAPI_TOKEN=seu_token_opcional_da_brapi
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=1025
EMAIL_FROM=noreply@investbr.local
```

Se seu SMTP exigir autenticacao, adicione tambem:

```env
EMAIL_SERVER_USER=seu_usuario
EMAIL_SERVER_PASSWORD=sua_senha
```

Observacao:
- O projeto le `EMAIL_SERVER_PASSWORD` (nao `EMAIL_SERVER_PASS`).
- `BRAPI_TOKEN` e opcional. Sem token as cotacoes continuam funcionando, com limite de requisicoes menor.

## 4) Instalar dependencias

Na raiz do projeto:

```bash
pnpm install
```

## 5) Rodar migrations do Prisma

```bash
npx prisma migrate dev
```

Isso cria/atualiza o schema no banco, incluindo tabelas de autenticacao.

## 6) Seed inicial (opcional, recomendado)

```bash
pnpm db:seed
```

## 7) Subir o servidor de desenvolvimento

```bash
pnpm dev
```

Acesse no navegador:

- http://localhost:3000

## 8) Rodar testes (opcional)

Execucao unica:

```bash
pnpm test
```

Modo watch:

```bash
pnpm test:watch
```

## 9) Comandos uteis

Build de producao:

```bash
pnpm build
```

Subir app em modo producao:

```bash
pnpm start
```
