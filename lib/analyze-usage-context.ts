import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { getOrCreateGuestId } from "@/lib/guest";
import { createUnlimitedUsageSnapshot } from "@/lib/analyze-usage-snapshot";

export type AnalyzeUsageTarget =
  | { type: "guest"; guestId: string }
  | { type: "user"; userId: string };

export type AnalyzeUsageWindow =
  | Awaited<ReturnType<typeof checkAnalyzeLimit>>
  | ReturnType<typeof createUnlimitedUsageSnapshot>;

export function getAnalyzeActor(target: AnalyzeUsageTarget) {
  return target.type === "user"
    ? `user:${target.userId}`
    : `guest:${target.guestId}`;
}

export async function resolveGuestAnalyzeUsageContext() {
  const guestId = await getOrCreateGuestId();
  const usageTarget: AnalyzeUsageTarget = { type: "guest", guestId };
  const usageWindow = await checkAnalyzeLimit({
    type: "guest",
    guestId,
  });

  return {
    usageTarget,
    usageWindow,
    actor: getAnalyzeActor(usageTarget),
  };
}

export async function resolveUserAnalyzeUsageContext(params: {
  userId: string;
  monthlyLimit: number;
  unlimited: boolean;
}) {
  const usageTarget: AnalyzeUsageTarget = { type: "user", userId: params.userId };
  const usageWindow = params.unlimited
    ? createUnlimitedUsageSnapshot()
    : await checkAnalyzeLimit({
        type: "user",
        userId: params.userId,
        monthlyLimitOverride: params.monthlyLimit,
      });

  return {
    usageTarget,
    usageWindow,
    actor: getAnalyzeActor(usageTarget),
  };
}
