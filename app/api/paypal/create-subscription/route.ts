import { NextRequest, NextResponse } from "next/server";
import { PAYPAL_PLAN_IDS, PAYPAL_PLANS, PayPalPlanId } from "@/lib/paypal";
import { auth } from "@/auth";

export const runtime = "edge";

/**
 * Create PayPal subscription
 * POST /api/paypal/create-subscription
 * Body: { planId: "pro-monthly" | "pro-yearly" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json() as { planId: PayPalPlanId };
    const plan = PAYPAL_PLANS[planId];
    const precreatedPlanId = PAYPAL_PLAN_IDS[planId];
    
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!precreatedPlanId) {
      console.error(`Plan ID not configured for ${planId}`);
      return NextResponse.json({ error: "Plan not configured" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // For sandbox, we use direct fetch to PayPal API
    const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
    const apiBaseUrl = isSandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";
    const authString = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    // Create subscription directly using pre-created plan ID
    const subscriptionRes = await fetch(`${apiBaseUrl}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify({
        plan_id: precreatedPlanId,
        subscriber: {
          email_address: session.user.email
        },
        application_context: {
          return_url: `${baseUrl}/dashboard?subscription=success`,
          cancel_url: `${baseUrl}/pricing?subscription=canceled`,
          brand_name: "Image Background Remover",
          landing_page: "LOGIN",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE"
        },
        custom_id: JSON.stringify({
          userId: (session.user as any).id,
          planType: planId
        })
      })
    });

    if (!subscriptionRes.ok) {
      const error = await subscriptionRes.text();
      console.error("Failed to create subscription:", error);
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    const subscription = await subscriptionRes.json();

    if (!subscription.id) {
      console.error("Failed to create subscription:", subscription);
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      approveUrl: subscription.links.find((link: any) => link.rel === "approve")?.href
    });

  } catch (error) {
    console.error("Error creating PayPal subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
