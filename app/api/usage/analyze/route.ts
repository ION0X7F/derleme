import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { getOrCreateGuestId } from "@/lib/guest";
import { getNextMonthlyRenewalDate } from "@/lib/usage";
import { getUsageStatus } from "@/lib/usage-status";

function getPlanLabel(plan: string | undefined, type: "user" | "guest") {
  if (type === "guest") return "Guest";
  if (plan === "PREMIUM") return "Pro";
  return "Free";
}

export async function GET() {
  try {
    const session = await auth();

    if (session?.user?.id) {
      const result = await checkAnalyzeLimit({
        type: "user",
        userId: session.user.id,
      });
      const planLabel = getPlanLabel(
        "plan" in session.user ? String(session.user.plan) : undefined,
        "user"
      );

      return NextResponse.json({
        type: "user",
        planLabel,
        renewalDate: getNextMonthlyRenewalDate().toISOString(),
        usageStatus: getUsageStatus({
          ...result,
          type: "user",
          planLabel,
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
      planLabel: getPlanLabel(undefined, "guest"),
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
