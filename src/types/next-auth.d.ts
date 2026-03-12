// src/types/next-auth.d.ts
import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      phone: string | null;
      emailVerified: Date | null;
      isActive: boolean;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    phone?: string | null;
    emailVerified?: Date | null;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    phone?: string | null;
    image?: string | null;
    emailVerified?: Date | null;
    isActive?: boolean;
  }
}