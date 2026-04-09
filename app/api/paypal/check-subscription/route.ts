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
      // 检查订阅状态和邮箱匹配 (APPROVED 也需要处理，测试订阅经常是这个状态)
      if (
        (sub.status === "ACTIVE" || sub.status === "APPROVED") && 
        sub.subscriber?.email_address === userEmail
      ) {
        // 获取 D1 database from environment
        const db = (globalThis as any).env?.DB || (process.env as any).DB;
        if (!db) {
          console.error("DB binding not found");
          continue;
        }

        let resolvedPlanType: string | null = null;
        const customId = sub.custom_id;
        
        // 1. 尝试从 custom_id 解析 userId 和 planType
        if (customId) {
          try {
            const { userId: customUserId, planType } = JSON.parse(customId);
            if (Number(customUserId) === userId) {
              resolvedPlanType = planType;
            }
          } catch (e) {
            console.error("Error parsing custom_id:", e);
          }
        }
        
        // 2. 如果没有解析到 planType，默认按 pro-monthly 处理
        if (!resolvedPlanType) {
          console.log(`[check-subscription] No valid custom_id, using default planType=pro-monthly for user ${userId}`);
          resolvedPlanType = "pro-monthly";
        }

        // 计算过期时间
        const startsAt = new Date();
        let expiresAt = new Date();
        if (resolvedPlanType === "pro-monthly") {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (resolvedPlanType === "pro-yearly") {
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
        const quota = resolvedPlanType === "pro-monthly" ? 200 : 2400;

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
            resolvedPlanType,
            resolvedPlanType === "pro-monthly" ? 12.00 : 99.00,
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

        console.log(`[check-subscription] Activated user ${userId} to ${resolvedPlanType}, status=${sub.status}`);
        foundActiveSubscription = true;
        break;
      }
    }

    // 如果没有通过列表找到，尝试查找当前用户邮箱匹配的任何计划，即使没有订阅
    if (!foundActiveSubscription) {
      console.log(`[check-subscription] No active subscription found for ${userEmail}`);
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
