// src/seed/seed-admin.ts
import { PrismaClient, UserRole } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

(async () => {
  try {
    const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    const name = (process.env.ADMIN_NAME ?? "Administrador").trim();

    if (!email) {
      throw new Error(
        "Falta ADMIN_EMAIL. Ejemplo: ADMIN_EMAIL=\"admin@tuapp.com\""
      );
    }

    if (!password || password.length < 6) {
      throw new Error(
        "Falta ADMIN_PASSWORD (mínimo 6 caracteres). Ejemplo: ADMIN_PASSWORD=\"TuClaveSegura\""
      );
    }

    const passwordHash = bcryptjs.hashSync(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: UserRole.ADMIN,
        isActive: true,
        passwordHash,
      },
      create: {
        email,
        name,
        role: UserRole.ADMIN,
        isActive: true,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log("✅ Admin listo:");
    console.log(user);
  } catch (err) {
    console.error("❌ Error creando admin:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();