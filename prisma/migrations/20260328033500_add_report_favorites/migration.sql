CREATE TABLE "ReportFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportFavorite_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReportFavorite_userId_reportId_key" ON "ReportFavorite"("userId", "reportId");
CREATE INDEX "ReportFavorite_userId_createdAt_idx" ON "ReportFavorite"("userId", "createdAt");
CREATE INDEX "ReportFavorite_reportId_idx" ON "ReportFavorite"("reportId");
