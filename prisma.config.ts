import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Carrega .env.local primeiro (tem prioridade), depois .env como fallback
config({ path: '.env.local', override: true })
config({ path: '.env' })

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})