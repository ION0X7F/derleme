import { PlanCode, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUnlimitedUser } from "@/lib/is-unlimited-user";

/**
 * Single source of truth for user plan determination.
 * 
 * Hierarchy (checked in order):
 * 1. Unlimited user override (ENV UNLIMITED_USER_EMAILS)
 * 2. Active subscription (Subscription table, only source for regular users)
 * 3. Free plan (default fallback)
 * 
 * Features:
 * - Consistent across auth callback, API routes, and client
 * - Single DB query for subscription check
 * - Transparent, testable, easy to audit
 */

const ENTITLED_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
]);

export async function resolvePlanForUser(
  userId: string,
  email?: string | null
): Promise<PlanCode> {
  // Step 1: Check unlimited user override (no DB query, ENV only)
  if (email && isUnlimitedUser(email)) {
    return "PREMIUM"; // Enterprise tier mapped to PREMIUM in schema
  }

  // Step 2: Query subscription (only source of truth for regular users)
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: {
        select: {
          code: true,
        },
      },
    },
  });

  // Step 3: Validate subscription is active and has plan
  if (
    subscription &&
    ENTITLED_STATUSES.has(subscription.status) &&
    subscription.plan?.code
  ) {
    return subscription.plan.code;
  }

  // Step 4: Default to FREE
  return PlanCode.FREE;
}

/**
 * Extended version returning full membership context.
 * Use when you need both plan code and subscription metadata.
 */
export async function resolvePlanFullContext(
  userId: string,
  email?: string | null
) {
  // Check unlimited first
  const isUnlimited = email && isUnlimitedUser(email);
  if (isUnlimited) {
    return {
      planCode: "PREMIUM" as const,
      isUnlimited: true,
      subscriptionStatus: null,
      hasEntitledSubscription: false,
      monthlyAnalysisLimit: null,
    };
  }

  // Query subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: {
        select: {
          code: true,
          monthlyAnalysisLimit: true,
        },
      },
    },
  });

  const hasEntitled = subscription && ENTITLED_STATUSES.has(subscription.status);
  const planCode = hasEntitled && subscription.plan?.code ? subscription.plan.code : PlanCode.FREE;

  return {
    planCode,
    isUnlimited: false,
    subscriptionStatus: subscription?.status ?? null,
    hasEntitledSubscription: hasEntitled,
    monthlyAnalysisLimit: hasEntitled && subscription?.plan?.monthlyAnalysisLimit
      ? subscription.plan.monthlyAnalysisLimit
      : null,
  };
}
