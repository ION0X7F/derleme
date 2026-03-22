import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resolvePlanForUser } from "@/lib/resolve-plan";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Sifre", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");

        if (!email || !password) return null;
        if (email.length > 160 || password.length > 128) return null;
        if (!EMAIL_PATTERN.test(email)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Resolve plan from subscription (single source of truth)
        const planCode = await resolvePlanForUser(user.id, email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: planCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Sign-in: use plan from authorize() (already resolved from subscription)
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.plan = (user as { plan?: string }).plan ?? "FREE";
        return token;
      }

      // Token refresh (not sign-in):
      // Keep existing plan from token. Subscription changes require re-login to take effect.
      // This avoids N+1 queries and potential race conditions during token refresh.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = String(token.role ?? "USER");
        session.user.plan = String(token.plan ?? "FREE");
      }
      return session;
    },
  },
});
