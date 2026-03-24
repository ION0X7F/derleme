import { prisma } from "@/lib/prisma";

export type ReportListQueryMode = "compact" | "full";

export const REPORT_LIST_COMPACT_SELECT = {
  id: true,
  url: true,
  platform: true,
  category: true,
  seoScore: true,
  dataCompletenessScore: true,
  overallScore: true,
  priceCompetitiveness: true,
  summary: true,
  dataSource: true,
  createdAt: true,
  extractedData: true,
  coverage: true,
  accessState: true,
} as const;

export const REPORT_LIST_FULL_SELECT = {
  ...REPORT_LIST_COMPACT_SELECT,
  conversionScore: true,
  derivedMetrics: true,
  suggestions: true,
  priorityActions: true,
  analysisTrace: true,
} as const;

export async function fetchReportListPage(params: {
  userId: string;
  take: number;
  cursor: number;
  mode: ReportListQueryMode;
}) {
  return prisma.report.findMany({
    where: {
      userId: params.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: params.cursor,
    take: params.take,
    select:
      params.mode === "full" ? REPORT_LIST_FULL_SELECT : REPORT_LIST_COMPACT_SELECT,
  });
}
