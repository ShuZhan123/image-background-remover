import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "edge";

/**
 * 检查用户是否已有激活的PayPal订阅，如果有则更新套餐状态
 * 这是一个兜底方案，解决webhook未触发的问题
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
    const apiBaseUrl = isSandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";
    const authString = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    // 获取用户的所有订阅
    const response = await fetch(
      `${apiBaseUrl}/v1/billing/subscriptions?page_size=20`,
      {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to list subscriptions:", await response.text());
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    const data = await response.json();
    const subscriptions = data.subscriptions || [];

    // 查找当前用户的活跃订阅
    let foundActiveSubscription = false;
    for (const sub of subscriptions) {
      // 检查订阅状态和邮箱匹配
      if (
        (sub.status === "ACTIVE" || sub.status === "APPROVED") && 
        sub.subscriber?.email_address === userEmail
      ) {
        // 解析 custom_id 获取 userId 和 planType
        const customId = sub.custom_id;
        if (!customId) continue;
        
        try {
          const { userId: customUserId, planType } = JSON.parse(customId);
          if (Number(customUserId) !== userId) continue;

          // 获取 D1 database from environment
          const db = (globalThis as any).env?.DB || (process.env as any).DB;
          if (!db) {
            console.error("DB binding not found");
            continue;
          }

          // 计算过期时间
          const startsAt = new Date();
          let expiresAt = new Date();
          if (planType === "pro-monthly") {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          } else if (planType === "pro-yearly") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          }

          // 更新用户套餐
          await db.prepare(`
            UPDATE users 
            SET plan_type = 'pro', 
                plan_expires_at = ?, 
                customer_id = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(expiresAt.toISOString(), sub.subscriber_id, userId).run();

          // 获取配额
          const quota = planType === "pro-monthly" ? 200 : 2400;

          // 检查是否已有此订阅记录
          const existing = await db.prepare(`
            SELECT id FROM subscriptions WHERE paypal_subscription_id = ?
          `).bind(sub.id).first();

          if (!existing) {
            // 创建订阅记录
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
              sub.id,
              sub.status.toLowerCase(),
              startsAt.toISOString(),
              expiresAt.toISOString()
            ).run();
          }

          // 更新用户配额
          await db.prepare(`
            UPDATE users SET quota_free_total = ? WHERE id = ?
          `).bind(quota, userId).run();

          console.log(`[check-subscription] Activated user ${userId} to ${planType}`);
          foundActiveSubscription = true;
          break;
        } catch (e) {
          console.error("Error parsing custom_id:", e);
          continue;
        }
      }
    }

    return NextResponse.json({
      found: foundActiveSubscription,
      updated: foundActiveSubscription
    });

  } catch (error) {
    console.error("Error checking subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
