import { PrismaClient } from "@prisma/client";
import {
  createPrismaAdapter,
  getRequiredDatabaseUrl,
} from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const databaseUrl = getRequiredDatabaseUrl();
const adapter = createPrismaAdapter(databaseUrl);

const prismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
export default prisma;
