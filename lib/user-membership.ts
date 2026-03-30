import {
  type UserRole,
} from "@prisma/client";
import { resolveAppPlanId, type RuntimePlanCode } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
type SubscriptionStatusValue = "ACTIVE" | "TRIALING" | "CANCELED" | "EXPIRED";
type SubscriptionPlanVariantValue = "FREE" | "PRO_MONTHLY" | "PRO_YEARLY" | "TEAM";

/**
 * @deprecated Use resolvePlanForUser() from lib/resolve-plan.ts instead.
 * This module is being phased out in favor of single-source-of-truth plan resolution.
 * Only kept for backward compatibility during transition period.
 */

const ENTITLED_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatusValue>(["ACTIVE", "TRIALING"]);

type MembershipRecord = {
  plan?: RuntimePlanCode | null;
  subscription?: {
    status?: SubscriptionStatusValue | null;
    variant?: SubscriptionPlanVariantValue | null;
    plan?: {
      code?: RuntimePlanCode | null;
      name?: string | null;
      monthlyAnalysisLimit?: number | null;
    } | null;
  } | null;
};

export function hasEntitledSubscription(status?: SubscriptionStatusValue | null) {
  return !!status && ENTITLED_SUBSCRIPTION_STATUSES.has(status);
}

export function getEffectivePlanCodeFromRecord(record: MembershipRecord): RuntimePlanCode {
  /**
   * @deprecated Use resolvePlanForUser() from lib/resolve-plan.ts instead.
   * This function will be removed after migration to subscription-only plan determination.
   */
  if (
    hasEntitledSubscription(record.subscription?.status) &&
    record.subscription?.plan?.code
  ) {
    return record.subscription.plan.code;
  }

  return "FREE";
}

export function getEffectivePlanNameFromRecord(record: MembershipRecord) {
  if (
    hasEntitledSubscription(record.subscription?.status) &&
    record.subscription?.plan?.name
  ) {
    return record.subscription.plan.name;
  }

  return getEffectivePlanCodeFromRecord(record) === "PREMIUM" ? "Pro" : "Free";
}

export function getEffectivePlanVariantFromRecord(record: MembershipRecord) {
  return resolveAppPlanId({
    planCode: getEffectivePlanCodeFromRecord(record),
    planVariant: record.subscription?.variant ?? null,
    planName: record.subscription?.plan?.name ?? null,
  });
}

export function getMembershipStatusLabel(status?: SubscriptionStatusValue | null) {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "TRIALING":
      return "Deneme";
    case "CANCELED":
      return "Iptal";
    case "EXPIRED":
      return "Suresi doldu";
    default:
      return "Kayit yok";
  }
}

export async function getUserMembershipSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      plan: true,
      subscription: {
        select: {
          status: true,
          variant: true,
          plan: {
            select: {
              code: true,
              name: true,
              monthlyAnalysisLimit: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const planCode = getEffectivePlanCodeFromRecord(user);
  const planName = getEffectivePlanNameFromRecord(user);
  const planId = getEffectivePlanVariantFromRecord(user);
  const subscriptionStatus = user.subscription?.status ?? null;

  return {
    userId: user.id,
    role: user.role as UserRole,
    planCode,
    planId,
    planName,
    subscriptionStatus,
    hasEntitledSubscription: hasEntitledSubscription(subscriptionStatus),
    monthlyAnalysisLimit: hasEntitledSubscription(subscriptionStatus)
      ? user.subscription?.plan?.monthlyAnalysisLimit ?? null
      : null,
  };
}
