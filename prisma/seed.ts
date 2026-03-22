import "dotenv/config";
import { PrismaClient, PlanCode } from "@prisma/client";
import {
  createPrismaAdapter,
  getRequiredDatabaseUrl,
} from "../lib/prisma-adapter";

const adapter = createPrismaAdapter(getRequiredDatabaseUrl());

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.plan.upsert({
    where: { code: PlanCode.FREE },
    update: {
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
    create: {
      code: PlanCode.FREE,
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

  await prisma.plan.upsert({
    where: { code: PlanCode.PREMIUM },
    update: {
      name: "Pro",
      description: "Gelişmis Trendyol analizi ve premium icgoru paketi",
      monthlyAnalysisLimit: 100,
      reportsHistoryLimit: 500,
      canExportReports: true,
      canUseAdvancedAi: true,
      canReanalyze: true,
      priceMonthly: 299,
      isActive: true,
    },
    create: {
      code: PlanCode.PREMIUM,
      name: "Pro",
      description: "Gelişmis Trendyol analizi ve premium icgoru paketi",
      monthlyAnalysisLimit: 100,
      reportsHistoryLimit: 500,
      canExportReports: true,
      canUseAdvancedAi: true,
      canReanalyze: true,
      priceMonthly: 299,
      isActive: true,
    },
  });

  console.log("Seed tamamlandi.");
}

main()
  .catch((e) => {
    console.error("Seed hatasi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
