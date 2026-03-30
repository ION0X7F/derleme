import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { getOrCreateGuestId } from "@/lib/guest";
import { getPlanDisplayName, resolveAppPlanId } from "@/lib/plans";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import { getNextMonthlyRenewalDate } from "@/lib/usage";
import { getUsageStatus } from "@/lib/usage-status";
import { createRequestId } from "@/lib/request-id";

export async function getAnalyzeUsageResponse() {
  const requestId = createRequestId("usage");

  try {
    const session = await auth();

    if (session?.user?.id) {
      const userAnalysisContext = await resolveUserAnalysisContext({
        userId: session.user.id,
        email: session.user.email ?? null,
      });
      const result = await checkAnalyzeLimit({
        type: "user",
        userId: session.user.id,
        monthlyLimitOverride: userAnalysisContext.monthlyLimit,
      });
      const planId = resolveAppPlanId({ planCode: userAnalysisContext.planCode });
      const planLabel = getPlanDisplayName(planId);

      return NextResponse.json({
        requestId,
        type: "user",
        planLabel,
        renewalDate: getNextMonthlyRenewalDate().toISOString(),
        usageStatus: getUsageStatus({
          ...result,
          type: "user",
          planLabel,
          planId,
        }),
        ...result,
      });
    }

    const guestId = await getOrCreateGuestId();
    const result = await checkAnalyzeLimit({
      type: "guest",
      guestId,
    });

    return NextResponse.json({
      requestId,
      type: "guest",
      planLabel: "Guest",
      renewalDate: getNextMonthlyRenewalDate().toISOString(),
      usageStatus: getUsageStatus({
        ...result,
        type: "guest",
        planLabel: "Guest",
      }),
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Kullanim bilgisi alinamadi.",
      },
      { status: 500 }
    );
  }
}
