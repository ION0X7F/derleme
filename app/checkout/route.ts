import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getStripe,
  getStripePriceIdForPlan,
  isStripeCheckoutPlanId,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const planId = request.nextUrl.searchParams.get("plan");
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `/checkout?plan=${encodeURIComponent(String(planId || ""))}`
    );

    if (planId) {
      loginUrl.searchParams.set("plan", planId);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (!isStripeCheckoutPlanId(planId)) {
    const cancelUrl = new URL("/billing/cancel", request.url);
    cancelUrl.searchParams.set("reason", "invalid-plan");
    return NextResponse.redirect(cancelUrl);
  }

  const priceId = getStripePriceIdForPlan(planId);

  if (!priceId) {
    const cancelUrl = new URL("/billing/cancel", request.url);
    cancelUrl.searchParams.set("reason", "missing-price");
    cancelUrl.searchParams.set("plan", planId);
    return NextResponse.redirect(cancelUrl);
  }

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: session.user.email,
    client_reference_id: session.user.id,
    allow_promotion_codes: true,
    success_url: `${request.nextUrl.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${request.nextUrl.origin}/billing/cancel?plan=${encodeURIComponent(planId)}`,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      planId,
    },
    subscription_data: {
      metadata: {
        userId: session.user.id,
        planId,
      },
    },
  });

  if (!checkoutSession.url) {
    const cancelUrl = new URL("/billing/cancel", request.url);
    cancelUrl.searchParams.set("reason", "session-url");
    cancelUrl.searchParams.set("plan", planId);
    return NextResponse.redirect(cancelUrl);
  }

  return NextResponse.redirect(checkoutSession.url);
}
