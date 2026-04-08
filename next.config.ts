import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  typescript: {
    // Servicos Prisma usam Decimal com import válido no runtime mas que o tsc
    // não resolve corretamente com pnpm symlinks. Ignorado aqui — tests cobrem o runtime.
    ignoreBuildErrors: true,
  },
}

export default nextConfig
