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

const needsFreshClient =
  !!globalForPrisma.prisma &&
  !("analyzeJob" in (globalForPrisma.prisma as PrismaClient & Record<string, unknown>));

const prismaClient =
  !globalForPrisma.prisma || needsFreshClient
    ? new PrismaClient({ adapter })
    : globalForPrisma.prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
export default prisma;
