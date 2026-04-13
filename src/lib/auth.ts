import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Nodemailer from 'next-auth/providers/nodemailer'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/login',
  },
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST ?? 'localhost',
        port: Number(process.env.EMAIL_SERVER_PORT ?? 1025),
        auth:
          process.env.EMAIL_SERVER_USER
            ? {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              }
            : undefined,
      },
      from: process.env.EMAIL_FROM ?? 'noreply@investbr.local',
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
