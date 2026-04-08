# Módulo: Auth (Autenticação)

## Objetivo

Gerenciar autenticação de usuários via magic link (e-mail sem senha). Utiliza NextAuth v5 com estratégia de sessão no banco de dados.

## Stack

- **NextAuth v5** (`next-auth@5.0.0-beta.30`) — framework de autenticação
- **@auth/prisma-adapter** — adaptador que persiste sessões no PostgreSQL
- **Nodemailer v7** — envio de magic links por e-mail (SMTP)
- **Estratégia**: `database` sessions (token na tabela `Session`)

## Fluxo de Autenticação

```
1. Usuário acessa /login
2. Informa e-mail → chama signIn('nodemailer', { email, redirect: false })
3. API /api/auth/[...nextauth] envia magic link por e-mail
4. Usuário clica no link → NextAuth valida token → cria/atualiza Session
5. Middleware redireciona para /dashboard
```

## Entidades (Prisma)

### AuthAccount (mapped: auth_accounts)
| Campo             | Tipo           | Descrição                          |
|-------------------|----------------|------------------------------------|
| id                | String (cuid)  | Identificador único                |
| userId            | String         | FK para User                       |
| type              | String         | Tipo do provider (e.g., "email")   |
| provider          | String         | Nome do provider (nodemailer)      |
| providerAccountId | String         | ID no provider                     |
| ...               | ...            | Campos opcionais OAuth             |

### Session
| Campo        | Tipo          | Descrição                             |
|--------------|---------------|---------------------------------------|
| id           | String (cuid) | Identificador                         |
| sessionToken | String        | Token único de sessão                 |
| userId       | String        | FK para User                          |
| expires      | DateTime      | Data de expiração                     |

### VerificationToken
| Campo      | Tipo     | Descrição                          |
|------------|----------|------------------------------------|
| identifier | String   | E-mail do usuário                  |
| token      | String   | Token do magic link                |
| expires    | DateTime | Expiração do token                 |

> Unique constraint: `[identifier, token]`

## Arquivos-chave

| Arquivo                                      | Função                                        |
|----------------------------------------------|-----------------------------------------------|
| `src/lib/auth.ts`                            | Configuração NextAuth — exporta `auth`, `handlers`, `signIn`, `signOut` |
| `src/app/api/auth/[...nextauth]/route.ts`    | Handler da API NextAuth                       |
| `middleware.ts`                              | Proteção de rotas (root-level)                |
| `src/types/next-auth.d.ts`                   | Augmentação de tipos — adiciona `user.id` à Session |
| `src/app/login/page.tsx`                     | Formulário de magic link (Client Component)   |
| `src/app/login/verify/page.tsx`              | Página de confirmação de envio                |
| `src/app/login/layout.tsx`                   | Layout da área de login (sem sidebar)         |

## Proteção de Rotas (middleware.ts)

- **Rotas públicas**: `/login/*`, `/api/auth/*`
- **Usuário autenticado em rota pública**: redireciona para `/dashboard`
- **Usuário não autenticado em rota protegida**: redireciona para `/login?callbackUrl=<rota>`
- **Matcher**: exclui assets estáticos (`_next/static`, imagens, `favicon.ico`)

## Grupos de Rotas (App Router)

```
src/app/
├── (app)/           ← rotas protegidas com sidebar
│   ├── layout.tsx   ← inclui <Sidebar />
│   ├── dashboard/
│   ├── accounts/
│   ├── assets/
│   └── transactions/
├── login/           ← rotas públicas sem sidebar
│   ├── layout.tsx
│   ├── page.tsx     ← magic link form
│   └── verify/
└── api/auth/[...nextauth]/
```

## Sessões em Server Components

```ts
// Qualquer Server Component ou Server Action
import { auth } from '@/lib/auth'

const session = await auth()
if (!session?.user?.id) throw new Error('Não autenticado')

// Filtrar dados por usuário
const data = await prisma.portfolio.findFirst({
  where: { userId: session.user.id }
})
```

## Server Actions com Autenticação

Padrão utilizado em `accounts/new/actions.ts` e `transactions/new/actions.ts`:

```ts
'use server'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function createXxxAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autenticado')

  // validações...
  // operações no banco...

  redirect('/destino')
}
```

## Variáveis de Ambiente Necessárias

| Variável          | Descrição                              |
|-------------------|----------------------------------------|
| `AUTH_SECRET`     | Secret para assinatura de tokens (obrigatório em produção) |
| `AUTH_URL`        | URL base da aplicação (ex: `http://localhost:3000`) |
| `EMAIL_SERVER_HOST` | Host SMTP                            |
| `EMAIL_SERVER_PORT` | Porta SMTP (587 para TLS, 465 para SSL) |
| `EMAIL_SERVER_USER` | Usuário SMTP                         |
| `EMAIL_SERVER_PASS` | Senha SMTP                           |
| `EMAIL_FROM`      | Remetente (ex: `"InvestBR" <no-reply@investbr.app>`) |

## Decisões de Design

- **DEC-011**: Magic link via Nodemailer escolhido por segurança (sem senhas armazenadas) e simplicidade de implementação.
- **DEC-012**: Estratégia `database` (não JWT) para sessões — permite revogar sessões imediatamente.
- **DEC-013**: `user.id` exposto na sessão via callback para permitir filtragem de dados por usuário em Server Components e Actions.

## Testes

Testes de integração em `__tests__/modules/actions.test.ts`:
- `createAccountAction`: acesso não autenticado, criação com redirect
- `getAccountsForUser`: retorno de contas por userId, array vazio sem sessão

Testes de componente em `__tests__/components/LoginPage.test.tsx`:
- Renderização do formulário
- Botão desabilitado com campo vazio
- Exibição de sucesso após envio
- Exibição de erro quando signIn falha
