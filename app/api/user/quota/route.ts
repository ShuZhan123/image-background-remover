import { auth } from "../../../../auth";

export const runtime = "edge";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : null;
    
    console.log(`[quota] globalThis.env: ${JSON.stringify((globalThis as any).env)}`);
    console.log(`[quota] process.env.DB: ${JSON.stringify(process.env.DB)}`);
    console.log(`[quota] D1 binding check: globalThis.env.DB = ${(globalThis as any).env?.DB}, process.env.DB = ${process.env.DB}`);
    
    // @ts-ignore - D1 binding available on Cloudflare Pages
    const db = (globalThis as any).env?.DB || (process.env as any).DB;
    
    if (!db || !userId) {
      console.log("[quota] DB not found or no user, returning default free quota");
      // Fallback for development
      return Response.json({
        freeUsed: 0,
        freeTotal: 5,
        paidUsed: 0,
        paidTotal: 0,
        planType: "free",
        planExpiresAt: null,
      });
    }

    console.log(`[quota] DB found, querying user ${userId}`);
    // 根据当前登录用户查询配额，而不是总是返回第一个用户
    const result = await db
      .prepare("SELECT quota_free_used, quota_free_total, quota_paid_used, quota_paid_total, plan_type, plan_expires_at FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!result) {
      console.log(`[quota] User ${userId} not found in database`);
      return Response.json({
        freeUsed: 0,
        freeTotal: 5,
        paidUsed: 0,
        paidTotal: 0,
        planType: "free",
        planExpiresAt: null,
      });
    }
    
    console.log(`[quota] Returning quota for user ${userId}: planType=${result.plan_type}, free=${result.quota_free_used}/${result.quota_free_total}, paid=${result.quota_paid_used}/${result.quota_paid_total}`);

    return Response.json({
      freeUsed: result.quota_free_used || 0,
      freeTotal: result.quota_free_total || 5,
      paidUsed: result.quota_paid_used || 0,
      paidTotal: result.quota_paid_total || 0,
      planType: result.plan_type || "free",
      planExpiresAt: result.plan_expires_at,
    });
  } catch (error) {
    console.error("Failed to get user quota:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
