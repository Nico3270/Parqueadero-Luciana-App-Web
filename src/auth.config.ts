// src/auth.config.ts
import type { NextAuthConfig } from "next-auth";
import { PrismaClient, UserRole } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/login",
  },

  trustHost: true,

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Sign-in inicial: user viene desde authorize()
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            image: true,
            emailVerified: true,
            isActive: true,
          },
        });

        if (!dbUser || !dbUser.isActive) return {};

        token.id = dbUser.id;
        token.name = dbUser.name ?? null;
        token.email = dbUser.email ?? null;
        token.role = dbUser.role;
        token.phone = dbUser.phone ?? null;
        token.image = dbUser.image ?? null;
        token.emailVerified = dbUser.emailVerified ?? null;
        token.isActive = dbUser.isActive;
      }

      // Si luego usas auth().update()
      if (trigger === "update") {
        const s = session as any;
        if (s?.name !== undefined) token.name = s.name;
        if (s?.phone !== undefined) token.phone = s.phone;
        if (s?.image !== undefined) token.image = s.image;
        if (s?.role !== undefined) token.role = s.role;
      }

      return token;
    },

    async session({ session, token }) {
      // session.user ya trae name/email/image a veces; aquí lo “normalizamos”
      session.user = {
        ...(session.user ?? {}),
        id: token.id as string,
        role: (token.role as UserRole) ?? UserRole.OPERATOR,
        name: (token.name as string) ?? session.user?.name ?? null,
        email: (token.email as string) ?? session.user?.email ?? null,
        phone: (token.phone as string) ?? null,
        image: (token.image as string) ?? session.user?.image ?? null,
        emailVerified: (token.emailVerified as Date | null) ?? null,
        isActive: (token.isActive as boolean) ?? true,
      } as any;

      return session;
    },
  },

  providers: [],
};