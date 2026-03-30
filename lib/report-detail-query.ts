import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function assertReportOwnershipBinding(
  data:
    | Prisma.ReportUncheckedCreateInput
    | Prisma.ReportCreateInput
) {
  const uncheckedData = data as Prisma.ReportUncheckedCreateInput;
  const hasUserId =
    typeof uncheckedData.userId === "string" && uncheckedData.userId.trim().length > 0;
  const hasGuestId =
    typeof uncheckedData.guestId === "string" && uncheckedData.guestId.trim().length > 0;
  const checkedData = data as Prisma.ReportCreateInput;
  const hasConnectedUser =
    !!checkedData.user &&
    "connect" in checkedData.user &&
    !!checkedData.user.connect &&
    typeof checkedData.user.connect.id === "string" &&
    checkedData.user.connect.id.trim().length > 0;

  const ownerBindings = [hasUserId || hasConnectedUser, hasGuestId].filter(Boolean).length;

  if (ownerBindings !== 1) {
    throw new Error(
      "REPORT_OWNER_BINDING_REQUIRED"
    );
  }
}

export const REPORT_DETAIL_SELECT = {
  id: true,
  url: true,
  platform: true,
  category: true,
  seoScore: true,
  conversionScore: true,
  overallScore: true,
  dataCompletenessScore: true,
  priceCompetitiveness: true,
  summary: true,
  dataSource: true,
  createdAt: true,
  extractedData: true,
  derivedMetrics: true,
  coverage: true,
  accessState: true,
  suggestions: true,
  priorityActions: true,
  analysisTrace: true,
} as const;

export const REPORT_EXPORT_SELECT = {
  id: true,
  url: true,
  platform: true,
  category: true,
  seoScore: true,
  conversionScore: true,
  overallScore: true,
  dataCompletenessScore: true,
  summary: true,
  dataSource: true,
  createdAt: true,
  extractedData: true,
  derivedMetrics: true,
  coverage: true,
  accessState: true,
  suggestions: true,
  priorityActions: true,
  analysisTrace: true,
} as const;

export const REPORT_REANALYZE_BASE_SELECT = {
  id: true,
  url: true,
  overallScore: true,
  accessState: true,
} as const;

export const REPORT_TIMELINE_SELECT = {
  id: true,
  createdAt: true,
  overallScore: true,
  dataSource: true,
  accessState: true,
} as const;

export async function fetchReportDetailForUser(params: {
  id: string;
  userId: string;
}) {
  return prisma.report.findFirst({
    where: {
      id: params.id,
      userId: params.userId,
    },
    select: REPORT_DETAIL_SELECT,
  });
}

export async function fetchReportExportForUser(params: {
  id: string;
  userId: string;
}) {
  return prisma.report.findFirst({
    where: {
      id: params.id,
      userId: params.userId,
    },
    select: REPORT_EXPORT_SELECT,
  });
}

export async function fetchReportReanalyzeBaseForUser(params: {
  id: string;
  userId: string;
}) {
  return prisma.report.findFirst({
    where: {
      id: params.id,
      userId: params.userId,
    },
    select: REPORT_REANALYZE_BASE_SELECT,
  });
}

export async function fetchReportTimelineForUser(params: {
  userId: string;
  url: string;
  take?: number;
}) {
  return prisma.report.findMany({
    where: {
      userId: params.userId,
      url: params.url,
    },
    orderBy: { createdAt: "desc" },
    take: typeof params.take === "number" ? params.take : 8,
    select: REPORT_TIMELINE_SELECT,
  });
}

export async function createReanalyzeReport(params: {
  data: Prisma.ReportUncheckedCreateInput;
}) {
  assertReportOwnershipBinding(params.data);
  return prisma.report.create({
    data: params.data,
  });
}

export async function createAnalyzeReport(params: {
  data: Prisma.ReportUncheckedCreateInput;
}) {
  assertReportOwnershipBinding(params.data);
  return prisma.report.create({
    data: params.data,
  });
}

export async function createAnalyzeReportInTransaction(params: {
  tx: Pick<Prisma.TransactionClient, "report">;
  data: Prisma.ReportUncheckedCreateInput;
}) {
  assertReportOwnershipBinding(params.data);
  return params.tx.report.create({
    data: params.data,
  });
}

export async function createAnalyzeReportWithUsageTransaction<T>(params: {
  consume: (
    tx: Pick<
      Prisma.TransactionClient,
      "report" | "guestUsageRecord" | "userUsageRecord"
    >
  ) => Promise<T>;
  data: Prisma.ReportUncheckedCreateInput;
}) {
  return prisma.$transaction(async (tx) => {
    const usage = await params.consume(tx);
    const report = await createAnalyzeReportInTransaction({
      tx,
      data: params.data,
    });

    return {
      usage,
      report,
    };
  });
}

export async function createSavedReport(params: {
  data: Prisma.ReportCreateInput;
}) {
  assertReportOwnershipBinding(params.data);
  return prisma.report.create({
    data: params.data,
  });
}
