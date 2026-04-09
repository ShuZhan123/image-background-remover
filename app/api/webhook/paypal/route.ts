import { NextRequest, NextResponse } from "next/server";
import { D1Database } from "@cloudflare/workers-types";

export const runtime = "edge";

const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// PayPal webhook handler - 处理订阅支付完成后更新用户套餐
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers = {
      "paypal-transmission-sig": req.headers.get("paypal-transmission-sig") || "",
      "paypal-transmission-id": req.headers.get("paypal-transmission-id") || "",
      "paypal-transmission-time": req.headers.get("paypal-transmission-time") || "",
      "paypal-cert-url": req.headers.get("paypal-cert-url") || "",
      "paypal-auth-algo": req.headers.get("paypal-auth-algo") || ""
    };

    const event = JSON.parse(body);
    console.log("PayPal webhook event:", event.event_type);

    // Verify webhook signature (if webhook id is configured)
    if (WEBHOOK_ID) {
      const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
      const baseUrl = isSandbox 
        ? "https://api.sandbox.paypal.com" 
        : "https://api.paypal.com";

      const authString = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString('base64');

      const verifyBody = {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: WEBHOOK_ID,
        webhook_event: event
      };

      try {
        const response = await fetch(
          `${baseUrl}/v1/notifications/verify-webhook-signature`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${authString}`,
            },
            body: JSON.stringify(verifyBody)
          }
        );
        
        const result = await response.json();
        
        if (result.verification_status !== "SUCCESS") {
          console.error("Webhook verification failed");
          return NextResponse.json({ error: "Verification failed" }, { status: 400 });
        }
      } catch (verifyError) {
        console.error("Error verifying webhook:", verifyError);
        // In sandbox, we can continue even if verification fails
        if (process.env.PAYPAL_ENVIRONMENT !== "sandbox") {
          return NextResponse.json({ error: "Verification failed" }, { status: 400 });
        }
      }
    }

    // Handle different event types
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.CREATED":
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "PAYMENT.SALE.COMPLETED":
        await handleSubscriptionActivated(event);
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
        await handleSubscriptionCanceled(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleSubscriptionActivated(event: any) {
  const subscription = event.resource;
  const customId = subscription.custom_id;
  
  if (!customId) {
    console.warn("No custom_id found in subscription");
    return;
  }

  try {
    const { userId, planType } = JSON.parse(customId);
    
    // Get D1 database from environment (Cloudflare Pages 绑定在 globalThis.env)
    const db = (globalThis as any).env?.DB || (process.env as any).DB;
    if (!db) {
      console.error("DB binding not found");
      return;
    }

    // Calculate expiration date
    const startsAt = new Date();
    let expiresAt = new Date();
    if (planType === "pro-monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (planType === "pro-yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Update user plan
    await db.prepare(`
      UPDATE users 
      SET plan_type = 'pro', 
          plan_expires_at = ?, 
          customer_id = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(expiresAt.toISOString(), subscription.subscriber_id, userId).run();

    // Get plan quota
    const quota = planType === "pro-monthly" ? 200 : 2400;

    // Create subscription record
    await db.prepare(`
      INSERT INTO subscriptions (
        user_id, plan_type, amount, currency, 
        paypal_subscription_id, status, started_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      planType,
      planType === "pro-monthly" ? 12.00 : 99.00,
      "USD",
      subscription.id,
      "active",
      startsAt.toISOString(),
      expiresAt.toISOString()
    ).run();

    // Update user quota
    await db.prepare(`
      UPDATE users SET quota_free_total = ? WHERE id = ?
    `).bind(quota, userId).run();

    console.log(`Updated user ${userId} to ${planType} subscription, expires ${expiresAt.toISOString()}`);
  } catch (parseError) {
    console.error("Error parsing custom_id:", parseError);
  }
}

async function handleSubscriptionCanceled(event: any) {
  const subscription = event.resource;
  const customId = subscription.custom_id;
  
  if (!customId) {
    console.warn("No custom_id found in subscription");
    return;
  }

  try {
    const { userId } = JSON.parse(customId);
    // Get D1 database from environment (Cloudflare Pages 绑定在 globalThis.env)
    const db = (globalThis as any).env?.DB || (process.env as any).DB;
    if (!db) {
      console.error("DB binding not found");
      return;
    }

    // Update subscription record status
    await db.prepare(`
      UPDATE subscriptions 
      SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
      WHERE paypal_subscription_id = ?
    `).bind(subscription.id).run();

    console.log(`Marked subscription ${subscription.id} as canceled for user ${userId}`);
  } catch (parseError) {
    console.error("Error parsing custom_id:", parseError);
  }
}
