import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import {
  isDiscordAuthConfigured,
  isGithubAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/auth-provider-config";
import { prisma } from "@/lib/prisma";
import { resolveAuthRedirectUrl } from "@/lib/auth-callback";
import { resolvePlanForUser } from "@/lib/resolve-plan";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureOAuthUser(params: {
  email: string;
  name?: string | null;
}) {
  const freePlan = await prisma.plan.upsert({
    where: { code: "FREE" },
    update: {},
    create: {
      code: "FREE",
      name: "Free",
      description: "Temel Trendyol analizi",
      monthlyAnalysisLimit: 10,
      reportsHistoryLimit: 5,
      canExportReports: false,
      canUseAdvancedAi: false,
      canReanalyze: false,
      priceMonthly: 0,
      isActive: true,
    },
  });

  const dbUser = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name || undefined,
    },
    create: {
      email: params.email,
      name: params.name || null,
      passwordHash: null,
      plan: "FREE",
    },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
    },
  });

  await prisma.subscription.upsert({
    where: { userId: dbUser.id },
    update: {},
    create: {
      userId: dbUser.id,
      planId: freePlan.id,
      status: "ACTIVE",
      variant: "FREE",
    },
  });

  return dbUser;
}

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
          username: user.username,
          role: user.role,
          plan: planCode,
        };
      },
    }),
    ...(isGoogleAuthConfigured()
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(isGithubAuthConfigured()
      ? [
          GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    ...(isDiscordAuthConfigured()
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (
        account?.provider &&
        account.provider !== "credentials"
      ) {
        const email = String(user?.email ?? token.email ?? "")
          .trim()
          .toLowerCase();

        if (!email || !EMAIL_PATTERN.test(email)) {
          return token;
        }

        const dbUser = await ensureOAuthUser({
          email,
          name: user?.name || null,
        });

        const planCode = await resolvePlanForUser(dbUser.id, email);

        token.id = dbUser.id;
        token.role = dbUser.role;
        token.plan = planCode;
        token.email = dbUser.email;
        token.name = dbUser.name ?? token.name;
        token.username = dbUser.username ?? token.username;
        return token;
      }

      if (user) {
        // Sign-in: use plan from authorize() (already resolved from subscription)
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.plan = (user as { plan?: string }).plan ?? "FREE";
        token.username = (user as { username?: string | null }).username ?? null;
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
        session.user.username =
          token.username == null ? null : String(token.username);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirectUrl(url, baseUrl);
    },
  },
});
