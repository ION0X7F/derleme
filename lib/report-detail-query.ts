import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
  return prisma.report.create({
    data: params.data,
  });
}

export async function createAnalyzeReport(params: {
  data: Prisma.ReportUncheckedCreateInput;
}) {
  return prisma.report.create({
    data: params.data,
  });
}

export async function createSavedReport(params: {
  data: Prisma.ReportCreateInput;
}) {
  return prisma.report.create({
    data: params.data,
  });
}
