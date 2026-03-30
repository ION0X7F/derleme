import Stripe from "stripe";
import {
  getPlanDefinition,
  isAppPlanId,
  isPaidPlanId,
  type AppPlanId,
} from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY tanimli degil.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET tanimli degil.");
  }

  return secret;
}

export function getStripePriceIdForPlan(planId: AppPlanId) {
  if (!isPaidPlanId(planId)) return null;

  const envMap: Record<Exclude<AppPlanId, "FREE">, string | undefined> = {
    PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    TEAM: process.env.STRIPE_PRICE_TEAM,
  };

  return envMap[planId] ?? null;
}

export function isStripeCheckoutPlanId(value?: string | null): value is AppPlanId {
  return isAppPlanId(value) && isPaidPlanId(value);
}

export function getStripeCheckoutPlanSummary(planId: AppPlanId) {
  const plan = getPlanDefinition(planId);
  const priceId = getStripePriceIdForPlan(planId);

  return {
    id: plan.id,
    name: plan.displayName,
    priceLabel: `${plan.priceLabel} ${plan.billingLabel}`.trim(),
    isConfigured: !!priceId,
    priceId,
  };
}
