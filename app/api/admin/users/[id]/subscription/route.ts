import { NextRequest, NextResponse } from "next/server";
import {
  PlanCode,
  SubscriptionPlanVariant,
  SubscriptionStatus,
} from "@prisma/client";
import { auth } from "@/auth";
import {
  getPlanDisplayName,
  getRuntimePlanCodeForPlanId,
  isAppPlanId,
  type AppPlanId,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getUserMembershipSnapshot } from "@/lib/user-membership";

type UpdateSubscriptionBody = {
  planId?: string;
  planCode?: string;
};

const ALLOWED_PLAN_CODES = new Set<PlanCode>([PlanCode.FREE, PlanCode.PREMIUM]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as UpdateSubscriptionBody;
  const requestedPlanId = String(body.planId || "").trim().toUpperCase();
  const normalizedPlanId: AppPlanId | null = isAppPlanId(requestedPlanId)
    ? requestedPlanId
    : null;
  const rawPlanCode = String(body.planCode || "").trim().toUpperCase();

  const rawResolvedPlanCode = normalizedPlanId
    ? getRuntimePlanCodeForPlanId(normalizedPlanId)
    : rawPlanCode;

  if (!ALLOWED_PLAN_CODES.has(rawResolvedPlanCode as PlanCode)) {
    return NextResponse.json(
      { error: "Gecersiz plan secimi." },
      { status: 400 }
    );
  }

  const planCode = rawResolvedPlanCode as PlanCode;

  const planVariant =
    normalizedPlanId === null
      ? rawPlanCode === "PREMIUM"
        ? SubscriptionPlanVariant.PRO_MONTHLY
        : SubscriptionPlanVariant.FREE
      : (normalizedPlanId as SubscriptionPlanVariant);

  const [targetUser, plan] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    }),
    prisma.plan.findUnique({
      where: { code: planCode },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    }),
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "Kullanici bulunamadi." }, { status: 404 });
  }

  if (!plan || !plan.isActive) {
    return NextResponse.json(
      { error: "Secilen plan aktif degil." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: targetUser.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        variant: planVariant,
        startDate: new Date(),
        endDate: null,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId: targetUser.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        variant: planVariant,
      },
    }),
    prisma.user.update({
      where: { id: targetUser.id },
      data: {
        plan: plan.code,
      },
    }),
  ]);

  const membership = await getUserMembershipSnapshot(targetUser.id);

  return NextResponse.json({
    success: true,
    userId: targetUser.id,
    email: targetUser.email,
    planCode: membership?.planCode ?? plan.code,
    planId: membership?.planId ?? normalizedPlanId ?? "FREE",
    planLabel: getPlanDisplayName(membership?.planId ?? normalizedPlanId ?? "FREE"),
    subscriptionStatus: membership?.subscriptionStatus ?? SubscriptionStatus.ACTIVE,
  });
}
