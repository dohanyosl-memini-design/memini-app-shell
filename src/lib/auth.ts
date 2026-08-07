import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Jelszó', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.active) return null

        // Zárolás: 5 hibás próbálkozás után 15 percre tiltjuk a fiókot. Így a
        // találgatás nem futtatható végtelenül, még ismert e-mail-cím mellett sem.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null

        const valid = await bcrypt.compare(credentials.password, user.password)

        if (!valid) {
          const failed = user.failedLogins + 1
          const lock = failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: lock ? 0 : failed, lockedUntil: lock },
          })
          return null
        }

        // Sikeres belépés — a számláló nullázódik.
        if (user.failedLogins > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: 0, lockedUntil: null },
          })
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 nap
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role = token.role as string
        ;(session.user as { role?: string; id?: string }).id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
