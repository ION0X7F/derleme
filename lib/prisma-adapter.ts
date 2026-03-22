import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

export function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
  }

  return databaseUrl;
}

export function createPrismaAdapter(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) {
    const sqlitePath = databaseUrl.replace(/^file:/, "");
    const absoluteSqlitePath = path.isAbsolute(sqlitePath)
      ? sqlitePath
      : path.resolve(process.cwd(), sqlitePath);

    return new PrismaBetterSqlite3({
      url: `file:${absoluteSqlitePath}`,
    });
  }

  const authToken =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  return new PrismaLibSql({
    url: databaseUrl,
    authToken: authToken || undefined,
  });
}
