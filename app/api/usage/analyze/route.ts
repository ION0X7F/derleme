import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPlanDisplayName } from "@/lib/plans";
import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { getOrCreateGuestId } from "@/lib/guest";
import { getUserMembershipSnapshot } from "@/lib/user-membership";
import { getNextMonthlyRenewalDate } from "@/lib/usage";
import { getUsageStatus } from "@/lib/usage-status";

export async function GET() {
  try {
    const session = await auth();

    if (session?.user?.id) {
      const membership = await getUserMembershipSnapshot(session.user.id);
      const result = await checkAnalyzeLimit({
        type: "user",
        userId: session.user.id,
      });
      const planLabel = membership?.planId
        ? getPlanDisplayName(membership.planId)
        : "Ucretsiz";

      return NextResponse.json({
        type: "user",
        planLabel,
        renewalDate: getNextMonthlyRenewalDate().toISOString(),
        usageStatus: getUsageStatus({
          ...result,
          type: "user",
          planLabel,
          planId: membership?.planId ?? "FREE",
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
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
