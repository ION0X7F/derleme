import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const rawDatabaseUrl = process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

if (!rawDatabaseUrl.startsWith("file:")) {
  throw new Error("Only SQLite file URLs are supported");
}

const sqlitePath = rawDatabaseUrl.replace(/^file:/, "");
const absoluteSqlitePath = path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.resolve(process.cwd(), sqlitePath);

const adapter = new PrismaBetterSqlite3({
  url: `file:${absoluteSqlitePath}`,
});

const prismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
export default prisma;