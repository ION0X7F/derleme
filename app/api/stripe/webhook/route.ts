import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getRuntimePlanCodeForPlanId, isAppPlanId, type AppPlanId } from "@/lib/plans";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

type MembershipStatus = "ACTIVE" | "CANCELED" | "EXPIRED" | "TRIALING";

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
  status: MembershipStatus;
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

function toMembershipStatus(status: Stripe.Subscription.Status): MembershipStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "canceled":
      return "CANCELED";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "EXPIRED";
    default:
      return "EXPIRED";
  }
}

function getPeriodEndDate(unixSeconds?: number | null) {
  return typeof unixSeconds === "number" && Number.isFinite(unixSeconds)
    ? new Date(unixSeconds * 1000)
    : null;
}

async function syncMembershipFromSubscription(subscription: Stripe.Subscription) {
  const userId = String(subscription.metadata?.userId || "").trim();
  const rawPlanId = String(subscription.metadata?.planId || "").trim().toUpperCase();

  if (!userId) {
    return;
  }

  if (!isAppPlanId(rawPlanId)) {
    if (subscription.status === "canceled") {
      await downgradeToFree(userId);
    }
    return;
  }

  const membershipStatus = toMembershipStatus(subscription.status);

  if (membershipStatus === "EXPIRED" && subscription.status !== "canceled") {
    await downgradeToFree(userId);
    return;
  }

  await syncMembershipFromPlan({
    userId,
    planId: rawPlanId,
    status: membershipStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    endDate: getPeriodEndDate(subscription.cancel_at ?? subscription.canceled_at),
  });
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

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const userId = String(session.metadata?.userId || session.client_reference_id || "").trim();

      if (userId) {
        await downgradeToFree(userId);
      }
    }

    if (event.type === "customer.subscription.created") {
      await syncMembershipFromSubscription(event.data.object);
    }

    if (event.type === "customer.subscription.updated") {
      await syncMembershipFromSubscription(event.data.object);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const userId = String(subscription.metadata?.userId || "").trim();

      if (userId) {
        await downgradeToFree(userId);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const invoiceMeta = invoice as Stripe.Invoice & {
        subscription_details?: {
          metadata?: {
            userId?: string;
          };
        };
        parent?: {
          subscription_details?: {
            metadata?: {
              userId?: string;
            };
          };
        };
      };
      const userId = String(
        invoiceMeta.subscription_details?.metadata?.userId ||
          invoiceMeta.parent?.subscription_details?.metadata?.userId ||
          ""
      ).trim();

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
