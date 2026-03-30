import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getRuntimePlanCodeForPlanId, isAppPlanId, type AppPlanId } from "@/lib/plans";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

async function ensurePlanRecord(planId: AppPlanId) {
  const runtimePlanCode = getRuntimePlanCodeForPlanId(planId);

  if (runtimePlanCode === "FREE") {
    return prisma.plan.upsert({
      where: { code: "FREE" },
      update: {
        name: "Free",
        description: "Temel Trendyol analizi",
        monthlyAnalysisLimit: 10,
        reportsHistoryLimit: 5,
        canExportReports: false,
        canUseAdvancedAi: false,
        canReanalyze: false,
        priceMonthly: 0,
        isActive: true,
      },
      create: {
        code: "FREE",
        name: "Free",
        description: "Temel Trendyol analizi",
        monthlyAnalysisLimit: 10,
        reportsHistoryLimit: 5,
        canExportReports: false,
        canUseAdvancedAi: false,
        canReanalyze: false,
        priceMonthly: 0,
        isActive: true,
      },
    });
  }

  return prisma.plan.upsert({
    where: { code: "PREMIUM" },
    update: {
      name: "Pro",
      description: "Gelismis Trendyol analizi ve premium icgoru paketi",
      monthlyAnalysisLimit: 100,
      reportsHistoryLimit: 500,
      canExportReports: true,
      canUseAdvancedAi: true,
      canReanalyze: true,
      priceMonthly: 399,
      isActive: true,
    },
    create: {
      code: "PREMIUM",
      name: "Pro",
      description: "Gelismis Trendyol analizi ve premium icgoru paketi",
      monthlyAnalysisLimit: 100,
      reportsHistoryLimit: 500,
      canExportReports: true,
      canUseAdvancedAi: true,
      canReanalyze: true,
      priceMonthly: 399,
      isActive: true,
    },
  });
}

async function syncMembershipFromPlan(params: {
  userId: string;
  planId: AppPlanId;
  status: "ACTIVE" | "CANCELED" | "EXPIRED" | "TRIALING";
  cancelAtPeriodEnd?: boolean;
  endDate?: Date | null;
}) {
  const plan = await ensurePlanRecord(params.planId);
  const runtimePlanCode = getRuntimePlanCodeForPlanId(params.planId);

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: params.userId },
      update: {
        planId: plan.id,
        status: params.status,
        variant: params.planId,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
        endDate: params.endDate ?? null,
        ...(params.status === "ACTIVE" || params.status === "TRIALING"
          ? { startDate: new Date() }
          : {}),
      },
      create: {
        userId: params.userId,
        planId: plan.id,
        status: params.status,
        variant: params.planId,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
        endDate: params.endDate ?? null,
      },
    }),
    prisma.user.update({
      where: { id: params.userId },
      data: {
        plan: runtimePlanCode,
      },
    }),
  ]);
}

async function downgradeToFree(userId: string) {
  const freePlan = await ensurePlanRecord("FREE");

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: freePlan.id,
        status: "EXPIRED",
        variant: "FREE",
        cancelAtPeriodEnd: false,
        endDate: new Date(),
      },
      create: {
        userId,
        planId: freePlan.id,
        status: "EXPIRED",
        variant: "FREE",
        endDate: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        plan: "FREE",
      },
    }),
  ]);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Stripe signature eksik." },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook dogrulanamadi.",
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = String(session.metadata?.userId || session.client_reference_id || "").trim();
      const rawPlanId = String(session.metadata?.planId || "").trim().toUpperCase();

      if (userId && isAppPlanId(rawPlanId)) {
        await syncMembershipFromPlan({
          userId,
          planId: rawPlanId,
          status: "ACTIVE",
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const userId = String(subscription.metadata?.userId || "").trim();

      if (userId) {
        await downgradeToFree(userId);
      }
    }
  } catch (error) {
    console.error("STRIPE_WEBHOOK_ERROR", error);
    return NextResponse.json(
      { error: "Webhook islenemedi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
