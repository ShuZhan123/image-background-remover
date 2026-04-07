import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { D1Database } from "@cloudflare/workers-types";

export const runtime = "edge";

/**
 * Cancel PayPal subscription
 * POST /api/paypal/cancel-subscription
 * Body: { subscriptionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId } = await req.json() as { subscriptionId: string };
    if (!subscriptionId) {
      return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
    }

    const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
    const baseUrl = isSandbox 
      ? "https://api.sandbox.paypal.com" 
      : "https://api.paypal.com";

    // Cancel the subscription at PayPal
    const authString = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const cancelResponse = await fetch(
      `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, 
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({ reason: "User requested cancellation" })
      }
    );

    if (cancelResponse.status !== 204) {
      const error = await cancelResponse.text().catch(() => "Unknown error");
      console.error("PayPal cancel error:", error);
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 400 });
    }

    // Update local database status
    const db = (process.env as any).DB as D1Database;
    if (db) {
      await db.prepare(`
        UPDATE subscriptions 
        SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
        WHERE paypal_subscription_id = ?
      `).bind(subscriptionId).run();
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error canceling PayPal subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
